console.clear();

const express = require("express");
const app = express();
const mysql = require("mysql");
const fs = require("fs");
const { dir } = require("console");

const conn = mysql.createConnection({
    host: "localhost",
    user: "linus",
    password: "Anf10@ng20De",
    database: "dataapi"
});

conn.connect(err => {
    if (err) return console.error(`[ERROR] ${err}`);
    console.log(`[INFO] Established connection to database`);
});

app.use(express.static(`${__dirname}/public`));

app.get('/request', (req, res) => {
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
                let urlParams = req.url.replace("/request?", "").toLowerCase().split("+");
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
                        if(fs.existsSync(path)) {
                            res.status(200).sendFile(path);
                            return console.log(`[INFO] File '${file}' was requested by '${tokenRdp.token}' (authorized)`);
                            
                        } else {
                            return res.status(404).send("file not found");
                        }

                    } else {
                        console.log(`[INFO] File '${file}' was requested by '${tokenRdp.token}' (unauthorized & stopped)`);
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

function hasAccess(tokenAccess, fileAccess) {
    if (tokenAccess == "*") return true;
    return tokenAccess == fileAccess;
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