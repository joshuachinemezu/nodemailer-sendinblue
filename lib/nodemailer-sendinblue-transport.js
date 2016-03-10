var assert        = require("assert");
var request       = require("request");
var _             = require("lodash");
var addressparser = require("addressparser");
var pkg           = require("../package.json");

// Sendinblue api codes. The code is included in the response body under 'code'.
var ApiCodes = {
    Success: "success",
    Failure: "failure",
    Error:   "error"
};

function checkOptions(options) {
    var apiKey = options.apiKey;
    var apiUrl = options.apiUrl;

    assert(apiKey && _.isString(apiKey), "apiKey: must be a non-empty string");
    assert(apiUrl && _.isString(apiUrl), "apiUrl: must be a non-empty string");
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
        obj[address.address] = address.name || "";
        return obj;
    }, {});
}

function transformFromAdresses(addresses) {
    var fromAddress = flattenGroups(addressparser(addresses))[0];

    return [fromAddress.address, fromAddress.name];
}

function SendinblueTransport(options) {
    checkOptions(options);

    this.options = options;
    this.name    = "sendinblue";
    this.version = pkg.version;
}

SendinblueTransport.prototype.send = function (mail, callback) {
    request({
        uri: this.sendUrl(),
        method: "POST",
        headers: {
            'api-key': this.options.apiKey
        },
        json: true,
        body: this.transformData(mail.data)
    }, function (err, response, body) {
        if (err) {
            return callback(err);
        }

        switch (body.code) {
            case ApiCodes.Failure:
            case ApiCodes.Error:
                return callback(new Error(body.message));
        }

        callback(null, { data: body.data });
    });
};

SendinblueTransport.prototype.sendUrl = function () {
    return this.options.apiUrl + "/email";
};

SendinblueTransport.prototype.transformData = function (data) {
    return {
        from:    transformFromAdresses(data.from),
        to:      transformAddresses(data.to),
        cc:      transformAddresses(data.cc),
        bcc:     transformAddresses(data.bcc),
        replyto: data.replyTo,
        subject: data.subject,
        text:    data.text,
        html:    data.html
    }
};

module.exports = function (options) {
    return new SendinblueTransport(options);
};
