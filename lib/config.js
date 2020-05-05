"use strict";
module.exports.password = process.env.password || "abc123";
module.exports.os = require("os");
module.exports.EOL = this.os.EOL;
module.exports.domain = process.env.domain_name || this.os.hostname();
module.exports.cores = process.env.cores || this.os.cpus().length;
module.exports.port = process.env.PORT || 80;
module.exports.colNames = [];
process.env.colNames.split(',').forEach(col => {
    this.colNames.push(col);
});