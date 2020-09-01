if (!process.env.disable_dotenv) {
    require('dotenv').config();
}
const fs = require('fs');

let notifiers = [];
const notifiers_path = `${__dirname}\\notifiers\\`;

fs.readdirSync(notifiers_path).forEach(file => {
    if (file != "exmple_notifier.js") {
        notifiers.push(require(`${notifiers_path}${file}`));
        console.log(`Notifier "${file}" loaded`);
    }
});

module.exports.send = function (column_name, data) {
    notifiers.forEach(notif => {
        notif.send(
            typeof data === 'object' ? 2 : 1,
            column_name,
            typeof data === 'object' ? null : data,
            (data.value > data.lastValue) ? "UP" : "DOWN",
            parseFloat(data.value),
            parseFloat(data.lastValue),
            data.time
        );
    });
}

process.argv.forEach(function (val) {
    if (val == "--test") {
        notifiers.forEach(notif => {
            notif.send("Test", "This is a test email", null, null, null, null, null, function (msg) {
                console.log("Email sent. Check your inbox of specified 'to' email account");
            });
        });
    }
});