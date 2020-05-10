let fs = require('fs'),
    logStream = fs.createWriteStream('visitor_log.txt', {
        flags: 'a'
    });
module.exports.log = function (message) {
    logStream.write(`[${new Date().toLocaleString('en-gb',{
        dateStyle: 'short',
        timeStyle: 'medium'
    })}]: ${message}\t\n`);
}