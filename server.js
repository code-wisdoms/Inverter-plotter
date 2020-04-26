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
let app = express();
app.engine('hbs', handlebars({
    layoutsDir: __dirname + '/views/layouts',
    partialsDir: __dirname + '/views/partials',
    extname: '.hbs',
    defaultLayout: 'main'
}));
app.set('view engine', 'hbs');
app.use(express.static('public'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.get('/', (req, res) => {
    res.render('home');
});
app.get('/csv', (req, res) => {
    res.render('csv');
});
app.post('/csv', uploadfile.single('logfile'), (req, res) => {
    logsToCSV(req.file.path, (file) => {
        res.download(__dirname + '\\' + file, file.substr(file.indexOf('\\')));
        setTimeout(() => {
            fs.unlinkSync(__dirname + '\\' + file);
        }, 20000);
    });
});
app.get('/chart', (req, res) => {
    res.render('chart', {
        colNames: config.colNames
    });
});
app.get('/table', (req, res) => {
    res.render('table');
});
app.post('/table', (req, res) => {
    let recordsTotal = 0;
    logs.select("SELECT COUNT(*) as count {t}", (err, row) => {
        recordsTotal = row[0].count;
    });
    logs.select(`SELECT * {t}
                ORDER BY ${req.body.columns[req.body.order[0].column].data} ${req.body.order[0].dir}
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
});
app.post('/upload', uploadfile.single('logfile'), (req, res) => {
    processLogs(req.file.path);
    res.json({
        status: 'success'
    });
});
app.get('/page/:name', (req, res) => {
    res.sendFile(__dirname + '/views/pages/' + req.params.name + '.html');
});
app.post('/charts', (req, res) => {
    let intervalNum = 0;
    let where = "";
    if (req.body.num) {
        intervalNum = parseInt(req.body.num);
        if (req.body.type && ['d', 'h', 'm', 's'].includes(req.body.type)) {
            switch (req.body.type) {
                case 'd':
                    intervalNum *= 8.64e+7;
                    break;
                case 'h':
                    intervalNum *= 3.6e+6;
                    break;
                case 'm':
                    intervalNum *= 60000;
                    break;
                case 's':
                    intervalNum *= 1000;
                    break;
            }
        }
    }
    if (req.body.fromdate && req.body.todate) {
        let date = req.body.todate.split('-');
        date[2] = parseInt(date[2]) + 1;
        where += ` WHERE dated BETWEEN ${new Date(req.body.fromdate).getTime()} AND ${new Date(date.join('-')).getTime()}`
    } else {
        if (req.body.fromdate) {
            where += " WHERE dated >= " + new Date(req.body.fromdate).getTime()
        }
        if (req.body.todate) {
            let date = req.body.todate.split('-');
            date[2] = parseInt(date[2]) + 1;
            where += " WHERE dated <= " + new Date(date.join('-')).getTime()
        }
    }
    logs.select(`SELECT dated, ${req.body.col} {t}${where}`, function (err, row) {
        if (!err) {
            let dated = 0;
            res.json(row.filter(function (item) {
                if (item.dated > dated) {
                    dated = parseInt(item.dated) + intervalNum;
                    return true;
                } else {
                    return false;
                }
            }).map((item) => {
                return Object.values(item);
            }));
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
app.all('*', (req, res) => {
    res.sendStatus(404).end();
});
app.listen(config.port, function () {
    console.log(`Server started at ${config.domain}:${config.port}`);
});

function processLogs(file) {
    let lineCount = 0;
    let wStream = fs.createWriteStream(file + "b", {
        encoding: "utf8"
    });
    let lineReader = require('readline').createInterface({
        input: fs.createReadStream(file)
    });
    lineReader.on('line', function (line) {
        let data = line.replace(/[\(\)\[\]]+/g, ' ').trim().split(' ');
        let date = new Date(data.splice(0, 2)).getTime();
        data.push(date);
        wStream.write(JSON.stringify(data) + "\r\n");
        lineCount++;
    });
    lineReader.on('close', () => {
        fs.unlink(file, () => {});
        logs.processfile(file + "b", lineCount);
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
        wStream.write(data.join(',') + "\r\n");
    });
    lineReader.on('close', () => {
        fs.unlink(file, () => {});
        callback(csvFile);
    });
}