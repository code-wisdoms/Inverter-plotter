const request = require('../request');

module.exports.send = function (type, message) {
    if (typeof message === 'string') {
        sendEmail(type, message);
    }
    if (typeof message === 'object') {
        sendEmail(
            (message.value > message.lastValue ? "[UP] " : "[DOWN] ") + type,
            `${type} just went ${message.value > message.lastValue ? "up" : "down"}.
            It has been ${message.value > message.lastValue ? "down" : "up"} for ${message.time}`);
    }
}


function sendEmail(type, message) {
    _sendEmail({
        personalizations: [{
            to: [{
                email: process.env.toEmail
            }]
        }],
        from: {
            email:  process.env.fromEmail
        },
        subject: `[Inverter] ${type}`,
        content: [{
            "type": "text/plain",
            "value": message
        }]
    })
}

function _sendEmail(data) {
    request.request2('https://api.sendgrid.com/v3/mail/send', {
        bearer:  process.env.sendgrid_key,
        json: data,
        method: 'POST'
    }, (res, err, body) => {
        if (res.statusCode < 200 || res.statusCode > 299) {
            console.log("Failed to send Email. Please check your SendGrid settings. Error:", res.statusCode, res.statusMessage);
            console.log("For details: https://sendgrid.com/docs/API_Reference/Web_API_v3/Mail/errors.html");
        }
    });
}