"use strict";
module.exports.password = process.env.password || "abc123";
module.exports.lineGraphTickLimit = parseInt(process.env.lineGraphTickLimit) || 40;
module.exports.os = require("os");
module.exports.EOL = this.os.EOL;
module.exports.domain = process.env.domain_name || this.os.hostname();
module.exports.cores = process.env.cores || this.os.cpus().length;
module.exports.port = process.env.PORT || 80;
module.exports.colNames = process.env.colNames.split(',');

if (!process.env.sendgrid_key) {
    console.log("[ERROR] SendGrid API key is required! please update .env file in root directory.");
    process.exit();
}
module.exports.sendgrid_key = process.env.sendgrid_key;

if (!process.env.fromEmail || !process.env.toEmail) {
    console.log("[ERROR] Missing 'to' or 'from' email. check your .env file!");
    process.exit();
}
if (process.env.fromEmail == process.env.toEmail) {
    console.log('[WARNING] Having same "to" and "from" email will result in your emails always going to spam folder!');
}
module.exports.fromEmail = process.env.fromEmail;
module.exports.toEmail = process.env.toEmail;