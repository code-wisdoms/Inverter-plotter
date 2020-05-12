if (!process.env.disable_dotenv) {
    require('dotenv').config();
}
let notifiers = [];

notifiers.push(require('./notifiers/sendgrid'));

module.exports.send = function (type, data) {
    notifiers.forEach(notif => {
        notif.send(type, data);
    });
}

process.argv.forEach(function (val) {
    if (val == "--test") {
        notifiers.forEach(notif => {
            notif.send("Test", "This is a test email", function (msg) {
                console.log("Email sent. Check your inbox of specified 'to' email account");
            });
        });
    }
});