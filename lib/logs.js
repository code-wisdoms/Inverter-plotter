"use strict";
const sqlite = require('sqlite3').verbose(),
    dbPath = __dirname + '\\..\\db\\logs.sqlite';
let db = new sqlite.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message, dbPath);
    } else {
        console.log('Connected to the logs database.');
    }
});
let total = 0,
    current = 0,
    complete = true,
    totalFiles = 0,
    filesQueue = [];
module.exports = {
    setTotalFileNum(num) {
        totalFiles += num;
    },
    insertSingle(value) {
        this._insert(value, (err) => {
            err && console.log(err);
        });
    },
    progress() {
        return {
            current: current,
            total: total,
            percentage: Math.round(((current) / total) * 100),
            complete: complete,
            totalFiles: totalFiles,
            remainingFiles: totalFiles - filesQueue.length
        };
    },
    select(q, callback) {
        db.all(q.replace(/\{t\}/, 'FROM logs'), callback);
    },
    createTable() {
        db.run(`CREATE TABLE if not exists logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grid_voltage REAL NOT NULL,
            grid_frequncy REAL NOT NULL,
            output_voltage REAL NOT NULL,
            output_frequency REAL NOT NULL,
            output_apparent_power INTEGER NOT NULL,
            output_active_power INTEGER NOT NULL,
            load INTEGER NOT NULL,
            bus_voltage INTEGER NOT NULL,
            battery_voltage REAL NOT NULL,
            battery_charge INTEGER NOT NULL,
            battery_capacity INTEGER NOT NULL,
            inverter_temp INTEGER NOT NULL,
            PV_A REAL NOT NULL,
            PV_V REAL NOT NULL,
            UNK1 REAL NOT NULL,
            battery_discharge INTEGER NOT NULL,
            inverter_mode INTEGER NOT NULL,
            UNK2 INTEGER NOT NULL,
            UNK3 INTEGER NOT NULL,
            pv_output_power INTEGER NOT NULL,
            UNK4 INTEGER NOT NULL,
            dated INTEGER NOT NULL UNIQUE
        `);
    },
    processfile(file, t) {
        if (complete) {
            this._processfile(file, t);
        } else {
            filesQueue.push({
                file: file,
                t: t
            });
        }
    },
    _processfile(file, t) {
        total = t;
        current = 0;
        complete = false;
        let fs = require('fs'),
            LineByLineReader = require('line-by-line'),
            lr = new LineByLineReader(file);
        db.run('begin');
        lr.on('line', (function (_this) {
            return function (line) {
                current++;
                _this._insert(JSON.parse(line), (err) => {
                    err && console.log(err);
                });
            }
        })(this));
        lr.on('error', function (err) {
            db.run('rollback');
            throw err;
        });
        lr.on('end', (function (_this) {
            return function () {
                db.run('commit');
                fs.unlink(file, (err) => {
                    err && console.log(err);
                });
                if (filesQueue.length > 0) {
                    file = filesQueue.pop();
                    _this._processfile(file.file, file.t);
                } else {
                    totalFiles = 0;
                    complete = true;
                }
            }
        })(this));
    },
    _insert(data, callback) {
        __insert(data, callback)
    }
}

function __insert(data, callback) {
    let query = `INSERT INTO logs (
        grid_voltage,
        grid_frequncy,
        output_voltage,
        output_frequency,
        output_apparent_power,
        output_active_power,
        load,
        bus_voltage,
        battery_voltage,
        battery_charge,
        battery_capacity,
        inverter_temp,
        PV_A,
        PV_V,
        UNK1,
        battery_discharge,
        inverter_mode,
        UNK2,
        UNK3,
        pv_output_power,
        UNK4,
        dated
    )
    VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    );`;
    db.run(query, data, (res, err) => {
        if (err) {
            callback(err);
        } else {
            callback(null);
        }
    });
}