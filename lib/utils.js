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
    }
}
