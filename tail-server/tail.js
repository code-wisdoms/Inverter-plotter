require('dotenv').config()

const Tail = require('tail').Tail,
    request = require('./lib/request'),
    logFilesPath = require('path').resolve(`${__dirname}/../`);

let listener = {
    host: process.env.listener.split(':')[0],
    port: process.env.listener.split(':')[1]
}
let tailMain = null,
    is_sending = false,
    logRows = [],
    lastTimestamp = 0;

request.sendToListener({
    ping: true,
    getLast: true
}, function (res, err, body) {
    if (!err && body && body.pong) {
        body.lastRow = JSON.parse(body.lastRow);
        if (Array.isArray(body.lastRow) && body.lastRow.length) {
            lastTimestamp = body.lastRow[0].dated;
        }
        start();
    } else {
        console.log("Couldn't reach listener server. Make sure you have set correct hostname to main server and a matching secret on both servers in .env file.");
        process.exit(1);
    }
});

function start() {
    let newDate = new Date();
    let year = newDate.getFullYear();
    let month = (newDate.getMonth() < 9) ? "0" + (newDate.getMonth() + 1) : (newDate.getMonth() + 1);
    let day = (newDate.getDate() <= 9) ? "0" + newDate.getDate() : newDate.getDate();

    let filename = `${logFilesPath}\\${`${year}-${month}-${day}`} QPIGS.log`;

    tailMain = startTail(filename);

    resetAtMidnight(function () {
        console.log("Switching file on new day to:", filename);
        tailMain.removeAllListeners();
        tailMain.unwatch();
        start();
    });
    if (tailMain) {
        console.log(`Tailing ${filename} and sending to ${listener.host}:${listener.port}`);
    } else {
        throw "There was an error starting tail library";
    }

}

function sendRow(row) {
    request.sendToListener({
        row: JSON.stringify(row)
    }, function (res, err, body) {
        if (!err && body && body.success) {
            if (logRows.length > 0) {
                sendRow(logRows.splice(0, logRows.length > 500 ? 500 : logRows.length));
            } else {
                is_sending = false;
            }
        } else {
            console.log(`Error reaching listener server at ${listener.host}:${listener.port}. retrying in 3 seconds!`);
            setTimeout(() => {
                sendRow(row);
            }, 30000);
        }
    })
}

function startTail(path) {
    if (!require('fs').existsSync(path)) {
        console.log("Log file not found at:", path);
        process.exit(1);
    }
    let tail = new Tail(path, {
        fromBeginning: true
    });

    tail.on("line", function (row) {
        if (row && row.length > 0) {
            let time = new Date(row.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ').splice(0, 2)).getTime();
            if (time > lastTimestamp) {
                logRows.push(row);
                if (!is_sending && (new Date().getTime() - time < 10000)) {
                    is_sending = true;
                    sendRow(logRows.splice(0, logRows.length > 500 ? 500 : logRows.length));
                }
            }
        }
    });

    tail.on("error", function (error) {
        console.log('ERROR: ', error);
    });
    return tail;
}

function resetAtMidnight(callback) {
    var now = new Date();
    var night = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0
    );
    var msToMidnight = night.getTime() - now.getTime();

    setTimeout(function () {
        callback();
    }, msToMidnight + 10000);
}