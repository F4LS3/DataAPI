console.clear();

const express = require("express");
const app = express();
const fileUpload = require("express-fileupload");
const mysql = require("mysql");
const fs = require("fs");

const config = require("./config.json");
const { isArray } = require("util");

const conn = mysql.createConnection({
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database
});

conn.connect(err => {
    if (err) return console.error(`[ERROR] Failed to connect to database: ${err}`);
    console.log(`[INFO] Established connection to database`);
});

app.use(express.static(`${__dirname}/public`));
app.use(fileUpload({ createParentPath: true }));

app.get('/get', (req, res) => {
    let token = req.headers.token;

    if (token == null || token == undefined) return res.sendStatus(401);

    conn.query(`SELECT * FROM \`dataapi_tokens\` WHERE token='${token}'`, (err, result) => {
        if (err) {
            res.status(400).send(`error: ${err}`)
            return console.error(`[ERROR] ${err}`);
        }

        let tokenRdp = result[0];

        if (tokenRdp != null) {
            if (tokenRdp.token != null) {
                let urlParams = req.url.replace("/get?", "").toLowerCase().split("+");
                let dir, file;
                urlParams.forEach(param => {
                    let params = param.split("=");

                    let request = params[0];
                    let value = params[1];

                    request == "dir" ? dir = value : file = value;
                });

                conn.query(`SELECT * FROM \`dataapi_access\` WHERE dir = '${dir}'`, (err, result) => {
                    if (err) {
                        res.status(400).send(`error: ${err}`);
                        return console.error(`[ERROR] ${err}`);
                    }

                    let fileRdp = result[0];

                    if (hasAccess(tokenRdp.access, fileRdp.access)) {
                        const path = `${__dirname}/data/${dir}/${file}`;

                        if (fs.existsSync(path)) {
                            res.status(200).sendFile(path);
                            return console.log(`[INFO] File '${file}' was requested by '${tokenRdp.token}' (authorized)`);

                        } else {
                            return res.status(404).send("file not found");
                        }

                    } else {
                        console.log(`[INFO] File '${file}' was requested by '${tokenRdp.token}' but wasn't permitted and therefore not sent`);
                        return res.sendStatus(401);
                    }
                });

            } else {
                return res.sendStatus(401);
            }

        } else {
            return res.sendStatus(401);
        }
    });
});

app.post('/post', (req, res) => {
    let token = req.headers.token;

    if (token == null || token == undefined) return res.sendStatus(401);

    conn.query(`SELECT * FROM \`dataapi_tokens\` WHERE token='${token}'`, (err, result) => {
        if (err) {
            res.status(400).send(`error: ${err}`);
            return console.error(`[ERROR] ${err}`);
        }

        let tokenRdp = result[0];

        if (tokenRdp != null) {
            if (tokenRdp.token != null) {
                let urlParams = req.url.replace("/post?", "").toLowerCase().split("+");
                let dir, file;
                urlParams.forEach(param => {
                    let params = param.split("=");

                    let request = params[0];
                    let value = params[1];

                    request == "dir" ? dir = value : file = value;
                });

                conn.query(`SELECT * FROM \`dataapi_access\` WHERE dir = '${dir}'`, (err, result) => {
                    if (err) {
                        res.status(400).send(`error: ${err}`);
                        return console.error(`[ERROR] ${err}`);
                    }

                    let fileRdp = result[0];

                    if (!req.files) return res.status(400).send("no file specified");

                    if (hasAccess(tokenRdp.access, fileRdp.access)) {
                        let data = [];

                        if (isArray(req.files.files)) {
                            let files = Object.keys(req.files.files);

                            files.forEach(key => {
                                let file = req.files.files[key];

                                file.mv(`${__dirname}/data/${dir}/${file.name}`);
                                data.push({
                                    name: file.name,
                                    mimetype: file.mimetype,
                                    size: file.size
                                });
                            });

                        } else {
                            let file = req.files.files;

                            file.mv(`${__dirname}/data/${dir}/${file.name}`);
                            data.push({
                                name: file.name,
                                mimetype: file.mimetype,
                                size: file.size
                            });
                        }
                        return res.status(200).send({ message: "Files uploaded successful", data: data });
                    
                    } else {
                        return res.sendStatus(401);
                    }
                });
            }
        }
    });
});

function hasAccess(tokenAccess, fileAccess) {
    return tokenAccess == "*" ? true : tokenAccess == fileAccess;
}

setInterval(() => {
    fs.readdir(`${__dirname}/data/`, (err, files) => {
        if (err) return console.error(`[ERROR] ${err}`);

        files.forEach(file => {
            let stats = fs.statSync(`${__dirname}/data/${file}`);

            if (stats.isFile()) {
                if (file.endsWith(".access")) {
                    fs.readFile(`${__dirname}/data/${file}`, (err, data) => {
                        if (err) return console.error(`[ERROR] ${err}`);

                        data = data.toString().toLowerCase();
                        conn.query(`SELECT EXISTS(SELECT * FROM \`dataapi_access\` WHERE dir = '${file.replace(".access", "")}') AS bool`, (err, result) => {
                            if (err) return console.error(`[ERROR] ${err}`);
                            if (result[0].bool) {
                                conn.query(`SELECT * FROM \`dataapi_access\` WHERE dir = '${file.replace(".access", "")}'`, (err, result) => {
                                    if (err) return console.error(`[ERROR] ${err}`);
                                    if (result[0].access != data) {
                                        conn.query(`UPDATE \`dataapi_access\` SET \`access\` = '${data}' WHERE dir = '${file.replace(".access", "")}'`);
                                        console.log(`[INFO] Updated access of '${file.replace(".access", "")}'`);
                                    }
                                });

                            } else {
                                conn.query(`INSERT INTO \`dataapi_access\` (\`id\`, \`dir\`, \`access\`) VALUES (NULL, '${file.replace(".access", "")}', '${data}')`);
                                console.log(`[INFO] Inserted directory '${file.replace(".access", "")}' into access table`);
                            }
                        });
                    });
                }
            }
        });
    });
}, 1000);

app.listen(8080, () => console.log(`[INFO] DataAPI listening on port 8080`));