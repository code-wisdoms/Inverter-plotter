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
    run(q, c) {
        db.each(q, c);
    },
    setTotalFileNum(num) {
        totalFiles += num;
    },
    insertSingle(value, bulk = false) {
        if (bulk) {
            db.run('begin;');
            value.forEach(row => {
                this._insert(row, (err) => {
                    err && console.log(err);
                });
            });
            db.run('commit;');
        } else {
            this._insert(value, (err) => {
                err && console.log(err);
            });
        }
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
    createTable(cback) {
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
            dated INTEGER NOT NULL UNIQUE);
        `, (res, err) => {
            err && console.log(err);
            db.run(`CREATE TABLE flags (
                name VARCHAR (30) PRIMARY KEY UNIQUE NOT NULL,
                value     DECIMAL (10, 3) NOT NULL,
                variation INTEGER,
                min       INTEGER,
                max       INTEGER,
                changed   INTEGER NOT NULL
            );`, (res, err) => {
                err && console.log(err);
                cback && cback();
            });
        });
    },
    refreshFlags(cback) {
        db.all("SELECT * FROM flags", cback);
    },
    deleteFlag(name) {
        db.run(`DELETE FROM flags WHERE name = ?`, [name]);
    },
    updateFlagValue(name, value) {
        db.run(`UPDATE flags SET value = ?, changed = ? WHERE name = ?`, [value, new Date().getTime(), name]);
    },
    updateFlag(name, variation, min, max) {
        let vals = [];
        vals[0] = 0,
            vals[1] = 0;
        vals[2] = 0;
        if (variation) {
            vals[0] = variation;
        }
        if (min) {
            vals[1] = min;
        }
        if (max) {
            vals[2] = max;
        }
        db.run(`UPDATE flags SET variation = ?,min = ?,max = ? WHERE name = '${name}'`, vals);
    },
    addFlag(name, variation, min, max) {
        this.select(`SELECT ${name} {t} ORDER BY dated DESC LIMIT 1`, (err, rows) => {
            err && console.log(err);
            if (!err) {
                let q = [];
                let vals = [name, rows.length ? parseInt(rows[0][name]) : 0, new Date().getTime()];
                if (variation) {
                    q.push(`variation`);
                    vals.push(parseInt(variation));
                }
                if (min) {
                    q.push(`min`);
                    vals.push(parseInt(min));
                }
                if (max) {
                    q.push(`max`);
                    vals.push(parseInt(max));
                }
                db.run(`INSERT INTO flags(name,value,changed,${q.join(',')})VALUES(?,?,?${',?'.repeat(q.length)});`, vals, (res, err) => {
                    err && console.log(err);
                });
            }
        });
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
    _processfile(file, t, recalled = false) {
        total = t;
        current = 0;
        complete = false;
        let fs = require('fs'),
            LineByLineReader = require('line-by-line'),
            lr = new LineByLineReader(file);
        if (!recalled) {
            db.run('begin');
        }
        lr.on('line', (function (_this) {
            return function (line) {
                current++;
                _this._insert(line.split(" "), (err) => {
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
                fs.unlink(file, (err) => {
                    err && console.log(err);
                });
                if (filesQueue.length > 0) {
                    file = filesQueue.pop();
                    _this._processfile(file.file, file.t, true);
                } else {
                    db.run('commit');
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