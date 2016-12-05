var assert        = require("assert");
var util          = require("util");
var http          = require("http");
var https         = require("https");
var url           = require("url");
var addressparser = require("addressparser");
var pkg           = require("../package.json");

//
// Constants
//
var STATUS_OK = 200;

//
// Helper
//
function isString(v) {
    return typeof v === "string" || v instanceof String;
}

function checkOptions(options) {
    var apiKey = options.apiKey;
    var apiUrl = options.apiUrl;

    assert(apiKey && isString(apiKey), "apiKey: must be a non-empty string");
    assert(apiUrl && isString(apiUrl), "apiUrl: must be a non-empty string");
}

function addAddress(obj, address) {
    obj[address.address] = address.name || "";
    return obj;
}

function flattenGroups(addresses) {
    var flattened = [];

    function traverse(obj) {
        if (obj.group) {
            obj.group.forEach(traverse);
        } else {
            flattened.push(obj);
        }
    }

    addresses.forEach(traverse);

    return flattened;
}

function transformAddresses(addresses) {
    return flattenGroups(addressparser(addresses)).reduce(function (obj, address) {
        return addAddress(obj, address);
    }, {});
}

function transformFromAddresses(addresses) {
    var fromAddress = flattenGroups(addressparser(addresses))[0];

    return [fromAddress.address, fromAddress.name];
}

function isErrorResponse(response) {
    if (response.statusCode !== STATUS_OK) {
        return true;
    }

    return false;
}

function responseError(response, body) {
    return new Error(
        util.format("%s (%s, %d)",
            body.message || "server error",
            body.code || "-",
            response.statusCode));
}

function makeInfo(data) {
    return {
        messageId: data["message-id"] || ""
    };
}

//
// Transport class
//
function SendinBlueTransport(options) {
    checkOptions(options);

    this.name    = "SendinBlue";
    this.version = pkg.version;

    this.reqOptions = url.parse(options.apiUrl + "/email");
    this.reqOptions.method = "POST";
    this.reqOptions.headers = {
        "api-key": options.apiKey,
        "Content-Type": "application/json"
    }; 
    
    this.reqBuilder = this.reqOptions.protocol === "https:" ? https.request : http.request;
}

SendinBlueTransport.prototype.send = function (mail, callback) {
    var req = this.reqBuilder(this.reqOptions, function (res) {
        res.setEncoding("utf-8");

        var data = "";
        res.on("data", function (chunk) {
            data += chunk;
        });

        res.on("end", function () {
            var body = {};

            try {
                body = JSON.parse(data);
            } catch (err) { /* Ignore error */ }

            if (isErrorResponse(res)) {
                return callback(responseError(res, body));
            }

            callback(null, makeInfo(body.data));
        });
    });

    req.write(JSON.stringify(this.transformData(mail.data)));
    req.end();
};

SendinBlueTransport.prototype.transformData = function (data) {
    return {
        from:    transformFromAddresses(data.from),
        to:      transformAddresses(data.to),
        cc:      transformAddresses(data.cc),
        bcc:     transformAddresses(data.bcc),
        replyto: transformFromAddresses(data.replyTo),
        subject: data.subject,
        text:    data.text,
        html:    data.html
    };
};

module.exports = function (options) {
    return new SendinBlueTransport(options);
};
