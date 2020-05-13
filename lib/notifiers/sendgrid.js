const request = require('../request'),
    config = require('../config');

module.exports.send = function (type, message, c = null) {    
    if (typeof message === 'string') {
        sendEmail(type, message);
    }
    if (typeof message === 'object') {
        message.value = parseInt(message.value);
        message.lastValue = parseInt(message.lastValue);
        sendEmail(
            `${(message.value > message.lastValue) ? "UP" : "DOWN"} ${type}`,
            `${type} just went ${(message.value > message.lastValue) ? "up" : "down"}.
It has been ${(message.value > message.lastValue) ? "down" : "up"} for ${message.time}`, c);
    }
}


function sendEmail(type, message, c = null) {
    _sendEmail({
        personalizations: [{
            to: [{
                email: config.toEmail
            }]
        }],
        from: {
            email: config.fromEmail
        },
        subject: `[Inverter] ${type}`,
        content: [{
            "type": "text/plain",
            "value": message
        }]
    }, c)
}

function _sendEmail(data, c = null) {
    request('https://api.sendgrid.com/v3/mail/send', {
        bearer: config.sendgrid_key,
        json: data,
        method: 'POST'
    }, (res, err, body) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
            console.log("Failed to send Email. Please check your SendGrid settings. Error:", res.statusCode, res.statusMessage);
            console.log("For details: https://sendgrid.com/docs/API_Reference/Web_API_v3/Mail/errors.html");
        } else {
            if (c) {
                c("Email sent successfully");
            }
        }
    });
}