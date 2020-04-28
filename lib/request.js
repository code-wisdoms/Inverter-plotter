"use strict";
const https = require('https'),
    querystring = require('querystring');
module.exports = function (url, opt, callback) {
    delete opt.url;
    let body = [];
    let postData = null;
    if (!opt.headers) {
        opt.headers = {
            'Accept': 'application/json'
        };
    }
    if (opt.auth) {
        opt.headers['Authorization'] = 'Basic ' + Buffer.from(opt.auth.username + ':' + opt.auth.password).toString('base64');
        delete opt.auth;
    }
    if (opt.json) {
        postData = JSON.stringify(opt.json);
        opt.headers['Content-Type'] = 'application/json';
        opt.headers['Content-Length'] = Buffer.byteLength(postData);
        delete opt.json;
    }
    if (opt.form) {
        postData = querystring.stringify(opt.form);
        opt.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        opt.headers['Content-Length'] = Buffer.byteLength(postData);
        delete opt.form;
    }
    let req = https.request(url, opt, (res) => {
        res.setEncoding("utf8");
        res.on("data", (data) => {
            body.push(data);
        });
        res.on("end", () => {
            try {
                body = JSON.parse(body.join(""));
            } catch (e) {
                body = null;
            }
            if (res.statusCode === 200 && body) {
                callback(res, null, body);
            } else {
                callback(res, null, body);
            }
        });
    }).on('error', (e) => {
        callback(null, e, null);
    });
    if (postData) {
        req.write(postData);
    }
    req.end();
}