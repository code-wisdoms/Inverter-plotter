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
    cookieParser = require('cookie-parser'),
    utils = require('./lib/utils'),
    logger = require('./lib/logger'),
    notifiers = require('./lib/notifier'),
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
let sessionsData = [],
    flagsData = [],
    emailSentUnder5Mins = [],
    notifEmailSent = false,
    lastRowRecievedAt = new Date().getTime();

logs.createTable(() => {
    logs.refreshFlags((err, rows) => {
        err && console.log(err);

        rows && rows.forEach(row => {
            flagsData[row.name] = row;
        });
    });
});
/**
 * Email cooldown
 */
setTimeout(() => {
    emailSentUnder5Mins = [];
}, 5 * 60 * 1000);
/**
 * Refresh flags
 */
setInterval(() => {
    logs.refreshFlags((err, rows) => {
        err && console.log(err);
        rows && rows.forEach(row => {
            flagsData[row.name] = row;
        });
    });
}, 60000);
let app = express();
const server = require('http').Server(app);

server.listen(config.port, function () {
    console.log(`Server started at ${config.domain}:${config.port}`);
});
const io = require('socket.io')(server);
io.on('connection', (socket) => {
    utils.get_ip_details(socket.handshake.address, function (data) {
        if (data) {
            logger.log(`${socket.handshake.address} - Socket - ${data}`);
        }
    });
    socket.on('message', function (data) {
        logger.log(`[Socket][MESSAGE] - ${data}`);
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
app.use(cookieParser());
app.use(function (req, res, next) {
    if (req.headers["x-forwarded-for"]) {
        let list = req.headers["x-forwarded-for"].split(",");
        req.userId = list[list.length - 1].replace(/\.+/g, '');
        utils.get_ip_details(list[list.length - 1], function (data) {
            if (data) {
                logger.log(` ${list[list.length - 1]} - HTTP - ${data}`);
            }
        });
    } else {
        req.userId = req.connection.remoteAddress.replace(/\.+/g, '');
        utils.get_ip_details(req.connection.remoteAddress, function (data) {
            if (data) {
                logger.log(` ${req.connection.remoteAddress} - HTTP - ${data}`);
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

let adminArea = new express.Router();
adminArea.use((req, res, next) => {
    let euid = req.cookies['euid'];
    if (euid && sessionsData[euid] && sessionsData[euid].loggedIn) {
        next();
    } else {
        if (req.xhr) {
            res.sendStatus(403).end();
        } else {
            res.redirect('/login');
        }
    }
});
adminArea.all('/logout', (req, res) => {
    let euid = req.cookies['euid']
    sessionsData[euid] = {};
    delete sessionsData[euid];
    res.clearCookie('euid');
    res.redirect('/');
});
adminArea.get('/', (req, res) => {
    res.redirect('/admin/notifications');
});
adminArea.get('/notifications', (req, res) => {
    res.render('notifications-table', {
        colNames: config.colNames,
        loggedIn: true
    });
});
adminArea.get('/notifications/delete/:name', (req, res) => {
    logs.deleteFlag(req.params.name);
    res.redirect('/admin/notifications');
});
adminArea.post('/notifications', (req, res) => {
    if (req.body.choice == 'variation') {
        req.body.min = 0;
        req.body.max = 0;
    } else {
        req.body.variation = 0;
    }
    if (req.body.edit) {
        logs.updateFlag(req.body.column, req.body.variation, req.body.min, req.body.max);
    } else {
        logs.addFlag(req.body.column, req.body.variation, req.body.min, req.body.max);
    }
    res.redirect('/admin/notifications');
});
adminArea.post('/notif_table', (req, res) => {
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
        logs.select("SELECT COUNT(*) as count FROM flags", (err, row) => {
            recordsTotal = row[0].count;
        });
        logs.select(`SELECT * FROM flags
                ORDER BY ${sqlQ.orderBy} ${sqlQ.dir}
                LIMIT ${req.body.length} OFFSET ${req.body.start}`, function (err, row) {
            if (!err) {
                let data = [];
                row.forEach(item => {
                    let dt = {};
                    req.body.columns.forEach((col) => {
                        if (col['data'] == 'changed') {
                            item[col['data']] = new Date(item[col['data']]).toLocaleString('en-gb', {
                                'dateStyle': 'short',
                                'timeStyle': 'medium'
                            });
                        }
                        if (col['data'] == 'actions') {
                            item[col['data']] = `<a data-toggle="modal" href='#modal-edit'><span class="glyphicon glyphicon-pencil btnEdit" aria-hidden="true" data-name="${item.name}"></span></a>`
                            item[col['data']] += `&nbsp;&nbsp;<a href="/admin/notifications/delete/${item.name}" onclick="alert('Are you sure you want to delete this entry?')"><span class="glyphicon glyphicon-trash" style="color:red;" aria-hidden="true"></span></a>`
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
adminArea.post('/getFlag', (req, res) => {
    logs.select(`SELECT * FROM flags WHERE name='${req.body.name}' LIMIT 1;`, (err, rows) => {
        if (err) {
            console.log(err);
            res.sendStatus(500).end();
        } else {
            res.json(rows[0]);
        }
    });
});
adminArea.get('/csv', (req, res) => {
    res.render('csv', {
        loggedIn: true
    });
});
adminArea.post('/csv', uploadfile.single('logfile'), (req, res) => {
    logsToCSV(req.file.path, (file) => {
        res.download(__dirname + '\\' + file, file.substr(file.indexOf('\\')));
        setTimeout(() => {
            fs.unlinkSync(__dirname + '\\' + file);
        }, 20000);
    });
});
adminArea.get('/upload', (req, res) => {
    res.render('upload', {
        loggedIn: true
    });
});
adminArea.post('/uploadfiles', uploadfile.array('logfile[]'), (req, res) => {
    processLogs(req.files);
    res.json({
        status: 'success'
    });
});
adminArea.get('/stats', (req, res) => {
    res.json(logs.progress());
});

app.get('/', (req, res) => {
    res.render('live', {
        wsurl: `ws://${config.domain}:${config.port}`,
        tickLimit: config.lineGraphTickLimit
    })
});
app.use('/admin', adminArea);
app.get('/login', (req, res) => {
    res.render('password');
});
app.post('/login', (req, res) => {
    if (req.body.password === config.password) {
        let euid = utils.makeid(50);
        sessionsData[euid] = {
            loggedIn: true
        };
        res.cookie('euid', euid);
        res.redirect('admin');
    } else {
        res.render('password', {
            retry: true
        })
    }
});
app.get('/public/:subdir/:file', function (request, response) {
    response.setHeader('Cache-Control', 'public, max-age=604800');
    response.sendFile(`${__dirname}/public/${request.params.subdir}/${request.params.file}`);
});
app.get('/public/:subdir/:subdir2/:file', function (request, response) {
    response.setHeader('Cache-Control', 'public, max-age=604800');
    response.sendFile(`${__dirname}/public/${request.params.subdir}/${request.params.subdir2}/${request.params.file}`);
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
                                'timeStyle': 'medium'
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
app.post("/inboundlogs", (req, res) => {
    if (req.body.secret === process.env.secret) {
        if (req.body.ping && req.body.getLast) {
            logs.select('SELECT dated {t} ORDER BY dated DESC LIMIT 1;', function (err, row) {
                res.json({
                    pong: "true",
                    lastRow: JSON.stringify(row)
                }).end();
            });
            return;
        } else if (req.body.ping) {
            res.json({
                pong: "true"
            }).end();
            return;
        }
        if (req.body.row) {
            lastRowRecievedAt = new Date().getTime();
            req.body.row = JSON.parse(req.body.row);
            if (req.body.row.length) {
                let rowArr = req.body.row.map(row => {
                    let data = row.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ');
                    let date = new Date(data.splice(0, 2)).getTime();
                    data.push(date);
                    return data;
                });
                if (rowArr.length == 1) {
                    rowArr = rowArr[0];
                    logs.insertSingle(rowArr);
                    ws_broadcast(JSON.stringify(rowArr));
                    config.colNames.forEach((element, index) => {
                        rowArr[index] = parseFloat(rowArr[index]);
                        if (flagsData[element]) {
                            if (flagsData[element].variation && !emailSentUnder5Mins[element]) {
                                if (Math.abs(flagsData[element].value - rowArr[index]) >= flagsData[element].variation) {
                                    let oldVal = flagsData[element].value;
                                    flagsData[element].value = rowArr[index];
                                    notifiers.send(
                                        flagsData[element].name.replace(/\_/g, ' '),
                                        Object.assign({
                                            lastValue: oldVal,
                                            time: utils.convertMS(new Date().getTime() - parseInt(flagsData[element].changed))
                                        }, flagsData[element])
                                    );
                                    flagsData[element].changed = new Date().getTime();
                                    logs.updateFlagValue(flagsData[element].name, rowArr[index]);
                                    emailSentUnder5Mins[element] = true;
                                }
                            }
                            if (flagsData[element].min && !emailSentUnder5Mins[element] && rowArr[index] != flagsData[element].value && rowArr[index] <= flagsData[element].min) {
                                let oldVal = flagsData[element].value;
                                flagsData[element].value = rowArr[index];
                                notifiers.send(
                                    flagsData[element].name.replace(/\_/g, ' '),
                                    Object.assign({
                                        lastValue: oldVal,
                                        time: utils.convertMS(new Date().getTime() - parseInt(flagsData[element].changed))
                                    }, flagsData[element])
                                );
                                flagsData[element].changed = new Date().getTime();
                                logs.updateFlagValue(flagsData[element].name, rowArr[index]);
                                emailSentUnder5Mins[element] = true;
                            }
                            if (flagsData[element].max && !emailSentUnder5Mins[element] && rowArr[index] != flagsData[element].value && rowArr[index] >= flagsData[element].max) {
                                let oldVal = flagsData[element].value;
                                flagsData[element].value = rowArr[index];
                                notifiers.send(
                                    flagsData[element].name.replace(/\_/g, ' '),
                                    Object.assign({
                                        lastValue: oldVal,
                                        time: utils.convertMS(new Date().getTime() - parseInt(flagsData[element].changed))
                                    }, flagsData[element])
                                );
                                flagsData[element].changed = new Date().getTime();
                                logs.updateFlagValue(flagsData[element].name, rowArr[index]);
                                emailSentUnder5Mins[element] = true;
                            }
                        }
                    });
                } else {
                    logs.insertSingle(rowArr, true);
                    ws_broadcast(JSON.stringify(rowArr[rowArr.length - 1]));
                }
                setTimeout(() => {
                    res.json({
                        success: true
                    });
                }, 1000);
            } else {
                console.log('Empty row recieved from tail');
            }
            return;
        }
    }
    res.sendStatus(404).end();
});
app.all('*', (req, res) => {
    res.sendStatus(404).end();
});

setInterval(() => {
    if ((new Date().getTime() - lastRowRecievedAt) > 3e5) {
        if (!notifEmailSent) {
            notifiers.send('[Down] Tail', 'Tail server is down from last 5 minutes!');
            notifEmailSent = true;
        }
        lastRowRecievedAt = new Date().getTime();
    }
}, 30000);

/* Wait 20 minutes before sending another notificaiton */
setInterval(() => {
    notifEmailSent = false;
}, 20 * 60 * 1000);

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