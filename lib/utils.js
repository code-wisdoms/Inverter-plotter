const request = require('./request');
module.exports = {
    makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    get_ip_details(ip, fc) {
        var temp = ip.replace("::ffff:", "");
        temp = temp.toString();

        if (temp.match("127.0.0.1")) {
            fc(false);
        } else {
            console.log("https://ipinfo.io" + "/" + temp + "/json");
        }
        request("https://ipinfo.io" + "/" + temp + "/json", {
            method: "GET"
        }, function (res, err, body) {
            if (err) {
                fc(false);
            }
            if (body && !body.error) {
                fc(body.city + ", " + body.region + ", " + body.country + ", " + body.org);
            } else {
                fc(false);
            }
        });
    },
    convertMS(ms) {
        var d, h, m, s;
        s = Math.floor(ms / 1000);
        m = Math.floor(s / 60);
        s = s % 60;
        h = Math.floor(m / 60);
        m = m % 60;
        d = Math.floor(h / 24);
        h = h % 24;

        var pad = function (n) {
            return n < 10 ? '0' + n : n;
        };

        var result = (d > 0 ? d + ' days ' : '') +
            (h > 0 ? pad(h) + " hours and " : '') +
            (m > 0 ? pad(m) + ' minutes' : '');
        return result;
    }
}