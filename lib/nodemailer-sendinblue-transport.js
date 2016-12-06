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

function isObject(v) {
    return !isUndefined(v) && v.toString() === "[object Object]";
}

function isArray(v) {
    return v instanceof Array;
}

function isUndefined(v) {
    return typeof v === "undefined";
}

function isEmpty(v) {
    return !(v.length || Object.keys(v).length)
}

function prefixedErr(err, prefix) {
    err.message = [prefix, err.message].join(": ");
    return err;
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

function transformAddress(a) {
    if (isString(a)) {
        return addressparser(a);
    }

    if (isObject(a)) {
        return [a];
    }

    throw new Error("invalid address: " + a);
}

function transformAddresses(addresses) {
    if (!addresses) {
        return undefined;
    }

    var parsed = [];
    if (isString(addresses)) {
        parsed = addressparser(addresses);
    } else if (isArray(addresses)) {
        addresses.forEach(function (address) {
            parsed = parsed.concat(transformAddress(address));
        });
    } else if (isObject(addresses)) {
        parsed.push(addresses);
    } else {
        throw new Error("invalid address: " + addresses);
    }

    return flattenGroups(parsed).reduce(addAddress, {});
}

function transformFromAddresses(addresses) {
    if (!addresses) {
        return undefined;
    }

    var transformed = transformAddresses(addresses);
    var from = Object.keys(transformed)[0];

    return [from, transformed[from]];
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

function makeInfo(body) {
    return {
        messageId: body.data["message-id"] || "",
        code: body.code,
        message: body.message
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

        var chunks = [];
        res.on("data", function (chunk) {
            chunks.push(chunk);
        }).on("end", function () {
            var body = {};

            try {
                var data = chunks.join("");
                body = JSON.parse(data);
            } catch (err) { /* Ignore error */ }

            if (isErrorResponse(res)) {
                return callback(responseError(res, body));
            }

            callback(undefined, makeInfo(body));
        });
    });

    req.on("error", function (err) {
        callback(new Error("error sending request: " + err.message));
    });

    try {
        var body = this.transformData(mail.data);
    } catch (err) {
        return callback(new Error("invalid mail options: " + err.message));
    }

    req.write(JSON.stringify(body));
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
        html:    data.html,
        headers: data.headers
    };
};

module.exports = function (options) {
    return new SendinBlueTransport(options);
};
