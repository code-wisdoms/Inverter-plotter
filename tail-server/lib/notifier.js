let notifiers = [];

notifiers.push(require('./notifiers/sendgrid'));

module.exports.send = function (type, data) {
    notifiers.forEach(notif => {
        notif.send(type, data);
    });
}