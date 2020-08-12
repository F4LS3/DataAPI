console.clear();

const express = require("express");
const app = express();
const mysql = require("mysql");
const fs = require("fs");

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
                let urlParams = req.url.replace("/request?", "").toLowerCase().split("=");
                let request = urlParams[0];
                let value = urlParams[1];

                if (request == "file") {
                    conn.query(`SELECT * FROM \`dataapi_file_access\` WHERE file='${value}'`, (err, result) => {
                        if (err) {
                            res.status(400).send(`error: ${err}`);
                            return console.error(`[ERROR] ${err}`);
                        }

                        let fileRdp = result[0];
                        if (hasAccess(tokenRdp.access, fileRdp.access)) {
                            res.status(200).sendFile(`${__dirname}/data/${tokenRdp.token}/${fileRdp.file}`);
                            console.log(`[INFO] File '${fileRdp.file}' was requested by '${tokenRdp.token}' (authorized)`);

                        } else {
                            return res.sendStatus(401);
                        }
                    });
                }

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
        files.forEach(file => {
            let stats = fs.statSync(`${__dirname}/data/${file}`);

            if(stats.isFile()) {
                if (file.endsWith(".access")) {
                    fs.readFile(`${__dirname}/data/${file}`, (err, data) => {
                        data = data.toString().toLowerCase();
                        conn.query("")
                    });
                }

            } else {

            }
        });
    });
}, 1000);

app.listen(8080, () => console.log(`[INFO] DataAPI listening on port 8080`));