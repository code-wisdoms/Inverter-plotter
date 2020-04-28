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
        request("https://ipinfo.io" + "/" + ip.toString() + "/json", {
            method: "GET"
        }, function (res, err, body) {
            if (err) {
                fc(false);
            }
            if (body && !body.error) {
                fc(body.city + ", " + body.region + ", " + body.country);
            } else {
                fc(false);
            }
        });
    }
}