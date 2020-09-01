const request = require('../request'),
    config = require('../config');

module.exports.send = function (type, column_name, message, status, value, oldValue, time_elapsed, c = null) {
    switch (type) {
        case 1: {
            sendEmail(column_name, message);
            break;
        }
        case 2: {
            sendEmail(
                `[${status}] ${column_name}`,
                `${column_name} just went ${status}.
                It has been ${ status == "UP" ? "down" : "up" } for ${time_elapsed}`, c);
            break;
        }
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