"use strict";
if (!process.env.disable_dotenv) {
    require('dotenv').config();
}
const config = require('./lib/config'),
    express = require('express'),
    multer = require('multer'),
    handlebars = require('express-handlebars'),
    bodyParser = require('body-parser'),
    logs = require('./lib/logs'),
    fs = require('fs'),
    utils = require('./lib/utils'),
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, "./temp");
        },
        filename: function (req, file, cb) {
            cb(null, new Date().getTime() + '-' + file.originalname);
        }
    }),
    uploadfile = multer({
        storage: storage
    });

logs.createTable();
let csrfToken = [];

//visit logger
var logStream = fs.createWriteStream('visitor_log.txt', {
    flags: 'a'
});

let app = express();
const server = require('http').Server(app);

server.listen(config.port, function () {
    console.log(`Server started at ${config.domain}:${config.port}`);
});
const io = require('socket.io')(server);
io.on('connection', (socket) => {
    utils.get_ip_details(socket.handshake.address, function (data) {
        if (data) {
            logStream.write(`[${new Date().toLocaleString()}]: ${socket.handshake.address} - Socket - ${data}\t\n`);
        }
    });
    socket.on('message', function (data) {
        logStream.write(`[${new Date().toLocaleString()}]:[Socket][MESSAGE] - ${data}\t\n`);
    });
});

function ws_broadcast(data) {
    io.emit('data', data);
}
app.engine('hbs', handlebars({
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
        if_equal: function (a, b, opts) {
            if (a == b) {
                return opts.fn(this)
            } else {
                return opts.inverse(this)
            }
        }
    }
}));
app.set('view engine', 'hbs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(function (req, res, next) {
    if (req.headers["x-forwarded-for"]) {
        let list = req.headers["x-forwarded-for"].split(",");
        req.userId = list[list.length - 1].replace(/\.+/g, '');
        utils.get_ip_details(list[list.length - 1], function (data) {
            if (data) {
                logStream.write(`[${new Date().toLocaleString()}]: ${list[list.length - 1]} - HTTP - ${data}\t\n`);
            }
        });
    } else {
        req.userId = req.connection.remoteAddress.replace(/\.+/g, '');
        utils.get_ip_details(req.connection.remoteAddress, function (data) {
            if (data) {
                logStream.write(`[${new Date().toLocaleString()}]: ${req.connection.remoteAddress} - HTTP - ${data}\t\n`);
            }
        });
    }
    let newDate = new Date();
    let year = newDate.getFullYear();
    let month = (newDate.getMonth() < 9) ? "0" + (newDate.getMonth() + 1) : (newDate.getMonth() + 1);
    let day = (newDate.getDate() <= 9) ? "0" + newDate.getDate() : newDate.getDate();
    req.todaysDate = `${year}-${month}-${day}`;

    newDate.setDate(newDate.getDate() - 7);
    year = newDate.getFullYear();
    month = (newDate.getMonth() < 9) ? "0" + (newDate.getMonth() + 1) : (newDate.getMonth() + 1);
    day = (newDate.getDate() <= 9) ? "0" + newDate.getDate() : newDate.getDate();
    req.prevWeek = `${year}-${month}-${day}`;

    next();
});
app.get('/', (req, res) => {
    res.render('live', {
        wsurl: `ws://${config.domain}:${config.port}`
    })
});
app.get('/public/:subdir/:file', function (request, response) {
    response.setHeader('Cache-Control', 'public, max-age=604800');
    response.sendFile(`${__dirname}/public/${request.params.subdir}/${request.params.file}`);
});
app.get('/public/:subdir/:subdir2/:file', function (request, response) {
    response.setHeader('Cache-Control', 'public, max-age=604800');
    response.sendFile(`${__dirname}/public/${request.params.subdir}/${request.params.subdir2}/${request.params.file}`);
});
app.all('/csv', (req, res) => {
    if (req.body && req.body.password && req.body.password == config.password) {
        csrfToken[req.userId] = utils.makeid(25);
        res.render('csv', {
            token: csrfToken[req.userId]
        });
    } else {
        res.render('password', {
            retry: (req.body && req.body.password)
        });
    }
});
app.post('/csvfile', uploadfile.single('logfile'), (req, res) => {
    if (req.body.token == csrfToken[req.userId]) {
        delete csrfToken[req.userId];
        logsToCSV(req.file.path, (file) => {
            res.download(__dirname + '\\' + file, file.substr(file.indexOf('\\')));
            setTimeout(() => {
                fs.unlinkSync(__dirname + '\\' + file);
            }, 20000);
        });
    } else {
        res.json({
            status: 'error',
            message: 'invalid request'
        });
    }
});
app.get('/table', (req, res) => {
    res.render('table');
});
app.post('/table', (req, res) => {
    if (!req.body) {
        res.sendStatus(404).end();
    } else {
        let recordsTotal = 0;
        let sqlQ = {};

        if (!req.body.length) {
            req.body.length = 10;
        }
        if (req.body.length < 0 || req.body.length > 100) {
            req.body.length = 10;
        }
        if (!req.body.order || !req.body.columns) {
            sqlQ.orderBy = 'dated';
            sqlQ.dir = 'DESC';
        } else {
            sqlQ.orderBy = req.body.columns[req.body.order[0].column].data;
            sqlQ.dir = req.body.order[0].dir;
        }
        if (!req.body.start) {
            req.body.start = 0;
        }
        logs.select("SELECT COUNT(*) as count {t}", (err, row) => {
            recordsTotal = row[0].count;
        });
        logs.select(`SELECT * {t}
                ORDER BY ${sqlQ.orderBy} ${sqlQ.dir}
                LIMIT ${req.body.length} OFFSET ${req.body.start}`, function (err, row) {
            if (!err) {
                let data = [];
                row.forEach(item => {
                    let dt = {};
                    req.body.columns.forEach((col) => {
                        if (col['data'] == 'dated') {
                            item[col['data']] = new Date(item[col['data']]).toLocaleString('en-gb', {
                                'dateStyle': 'short',
                                'timeStyle': 'short'
                            });
                        }
                        dt[col['data']] = item[col['data']];
                    });
                    data.push(dt);
                });
                res.json({
                    "draw": req.body.draw,
                    "recordsFiltered": recordsTotal,
                    "recordsTotal": recordsTotal,
                    "data": data
                });
            } else {
                res.json({
                    status: 'error',
                    message: err
                });
            }
        });
    }
});
app.all('/upload', (req, res) => {
    if (req.body && req.body.password && req.body.password == config.password) {
        csrfToken[req.userId] = utils.makeid(25);
        res.render('upload', {
            token: csrfToken[req.userId]
        });
    } else {
        res.render('password', {
            retry: (req.body && req.body.password)
        });
    }
});
app.post('/uploadfiles', uploadfile.array('logfile[]'), (req, res) => {
    if (req.body.token == csrfToken[req.userId]) {
        delete csrfToken[req.userId];
        processLogs(req.files);
        res.json({
            status: 'success'
        });
    } else {
        res.json({
            status: 'error',
            message: 'invalid request'
        });
    }
});
app.get('/page/:name', (req, res) => {
    res.sendFile(__dirname + '/views/pages/' + req.params.name + '.html');
});
app.get('/chart/:name', (req, res) => {

    let obj = {
        colNames: config.colNames,
        todaysDate: req.todaysDate,
        prevWeek: req.prevWeek
    };

    res.render(`chart-${req.params.name}`, obj);
});
app.post('/chart/bar', (req, res) => {
    let where = `SELECT strftime('%d-%m-%Y', dated / 1000.0, 'unixepoch', 'localtime') AS dateAdded, dated,`;
    req.body.cols.forEach((col, i) => {
        if (req.body.type == "AVG" && ['output_apparent_power', 'output_active_power'].includes(req.body.cols[i])) {
            where += ` (round(${req.body.type}(${col}))*24)/1000 as col${i+1},`;
        } else {
            where += ` round(${req.body.type}(${col})) as col${i+1},`;
        }
    });
    where = where.replace(/\,$/g, '');
    where += " FROM logs";
    if (!req.body.fromdate) {
        req.body.fromdate = req.todaysDate;
    }
    if (!req.body.todate) {
        req.body.todate = req.todaysDate;
    }
    if (req.body.fromdate && req.body.todate) {
        let date = req.body.todate.split('-');
        date[2] = parseInt(date[2]) + 1;
        where += ` WHERE dated BETWEEN ${new Date(req.body.fromdate+" ").getTime()} AND ${new Date(date.join('-')+" ").getTime()}`;
    } else {
        if (req.body.fromdate) {
            where += " WHERE dated >= " + new Date(req.body.fromdate + " ").getTime()
        }
        if (req.body.todate) {
            let date = req.body.todate.split('-');
            date[2] = parseInt(date[2]) + 1;
            where += " WHERE dated <= " + new Date(date.join('-') + " ").getTime()
        }
    }
    where += " GROUP BY CAST(dateAdded AS DATE) ORDER BY dated ASC;";

    logs.select(where, function (err, row) {
        if (!err) {
            res.json(row);
        } else {
            res.json({
                status: 'error',
                message: err
            });
        }
    });
});
app.post('/chart/candle', (req, res) => {
    let where = `SELECT
                strftime('%d-%m-%Y', dated / 1000.0, 'unixepoch', 'localtime') AS dateAdded,
                MIN(${req.body.col}) AS min,
                MAX(${req.body.col}) AS max
                FROM logs`;

    if (!req.body.fromdate) {
        req.body.fromdate = req.todaysDate;
    }
    if (!req.body.todate) {
        req.body.todate = req.todaysDate;
    }
    if (req.body.fromdate && req.body.todate) {
        let date = req.body.todate.split('-');
        date[2] = parseInt(date[2]) + 1;
        where += ` WHERE dated BETWEEN ${new Date(req.body.fromdate+" ").getTime()} AND ${new Date(date.join('-')+" ").getTime()}`;
    } else {
        if (req.body.fromdate) {
            where += " WHERE dated >= " + new Date(req.body.fromdate + " ").getTime()
        }
        if (req.body.todate) {
            let date = req.body.todate.split('-');
            date[2] = parseInt(date[2]) + 1;
            where += " WHERE dated <= " + new Date(date.join('-') + " ").getTime()
        }
    }
    where += " GROUP BY CAST(dateAdded AS DATE) ORDER BY dated ASC;";
    logs.select(where, function (err, row) {
        if (!err) {
            res.json(row);
        } else {
            res.json({
                status: 'error',
                message: err
            });
        }
    });
});
app.post('/chart/ann', (req, res) => {
    let where = "";
    let timeFrmtStr = "";
    switch (req.body.type) {
        case "s": {
            if (req.body.todate == req.body.fromdate) {
                timeFrmtStr = "%S";
            }
        }
        case "m": {
            if (req.body.todate == req.body.fromdate) {
                timeFrmtStr = "%M" + timeFrmtStr;
            }
        }
        case "h": {
            timeFrmtStr = "%H" + timeFrmtStr;
        }
        case "d": {
            timeFrmtStr = "%d" + timeFrmtStr;
        }
        case "mm": {
            timeFrmtStr = "%m" + timeFrmtStr;
        }
        case "y": {
            timeFrmtStr = "%Y" + timeFrmtStr;
            break;
        }
        default: {
            timeFrmtStr = "%Y%m%d%";
            break;
        }
    }
    if (!req.body.fromdate) {
        req.body.fromdate = req.todaysDate;
    }
    if (!req.body.todate) {
        req.body.todate = req.todaysDate;
    }
    if (req.body.fromdate && req.body.todate) {
        let date = req.body.todate.split('-');
        date[2] = parseInt(date[2]) + 1;
        where += ` WHERE dated BETWEEN ${new Date(req.body.fromdate+" ").getTime()} AND ${new Date(date.join('-')+" ").getTime()}`;
    } else {
        if (req.body.fromdate) {
            where += " WHERE dated >= " + new Date(req.body.fromdate + " ").getTime()
        }
        if (req.body.todate) {
            let date = req.body.todate.split('-');
            date[2] = parseInt(date[2]) + 1;
            where += " WHERE dated <= " + new Date(date.join('-') + " ").getTime()
        }
    }
    let cols = "";
    let totalCols = 0;
    req.body.cols.forEach((item, ix) => {
        totalCols++;
        if (req.body.type == 'd' && ['output_apparent_power', 'output_active_power'].includes(req.body.cols[ix])) {
            cols += ` (AVG(${item})*24)/1000 as col${ix+1},`;
        } else {
            cols += ` AVG(${item}) as col${ix+1},`;
        }
    });

    logs.select(`SELECT dated,
    ${cols} strftime('${timeFrmtStr}',
    datetime(dated / 1000, 'unixepoch', 'localtime')) as date2
    {t} ${where}
    GROUP BY strftime('${timeFrmtStr}', datetime(dated / 1000, 'unixepoch', 'localtime'))
    ORDER BY dated DESC;`, function (err, row) {
        if (!err) {
            res.json(row);
        } else {
            res.json({
                status: 'error',
                message: err
            });
        }
    });
});
app.get('/stats', (req, res) => {
    res.json(logs.progress());
});
app.post("/inboundlogs", (req, res) => {
    if (req.body.secret === process.env.secret) {
        if (req.body.ping) {
            res.json({
                pong: "true"
            }).end();
            return;
        }
        if (req.body.row) {
            req.body.row = JSON.parse(req.body.row);
            let data = req.body.row.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ');
            let date = new Date(data.splice(0, 2)).getTime();
            data.push(date);
            logs.insertSingle(data);
            ws_broadcast(JSON.stringify(data));
            res.json({
                success: true
            });
            return;
        }
    }
    res.sendStatus(404).end();
});
app.all('*', (req, res) => {
    res.sendStatus(404).end();
});

function processLogs(files) {
    logs.setTotalFileNum(files.length);
    files.forEach((fileObj, i) => {
        let lineCount = 0;
        let file = __dirname + '/' + fileObj.path + 'b';
        let wStream = fs.createWriteStream(file, {
            encoding: "utf8"
        });
        let lineReader = require('readline').createInterface({
            input: fs.createReadStream(__dirname + '/' + fileObj.path)
        });
        lineReader.on('line', function (line) {
            let data = line.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ');
            let date = new Date(data.splice(0, 2)).getTime();
            data.push(date);
            wStream.write(data.join(" ") + config.EOL);
            lineCount++;
        });
        lineReader.on('close', () => {
            fs.unlink(__dirname + '/' + fileObj.path, () => {});
            logs.processfile(file, lineCount);
        });
    });
}

function logsToCSV(file, callback) {
    let csvFile = file.substr(0, file.lastIndexOf('.')) + ".csv";
    let wStream = fs.createWriteStream(csvFile, {
        encoding: "utf8"
    });
    let lineReader = require('readline').createInterface({
        input: fs.createReadStream(file)
    });
    wStream.write('grid_voltage,grid_frequncy,output_voltage,output_frequency,output_apparent_power,output_active_power,load,bus_voltage,battery_voltage,battery_charge,battery_capacity,inverter_temp,PV_A,PV_V,UNK1,battery_discharge,inverter_mode,UNK2,UNK3,pv_output_power,UNK4,dated' + "\r\n");
    lineReader.on('line', function (line) {
        let data = line.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ');
        let date = new Date(data.splice(0, 2)).toLocaleString('en-gb', {
            dateStyle: 'short',
            timeStyle: 'short'
        }).replace(/\,/g, '');
        data.push(date);
        wStream.write(data.join(',') + config.EOL);
    });
    lineReader.on('close', () => {
        fs.unlink(file, () => {});
        callback(csvFile);
    });
}