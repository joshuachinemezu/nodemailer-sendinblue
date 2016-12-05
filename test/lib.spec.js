var assert = require("assert");
var nodemailer = require("nodemailer");
var sendinblue = require("../lib/nodemailer-sendinblue-transport");


function MockTransport(sb) {
    assert(sb);
    this.sb = sb;
    this.data = undefined;
}

MockTransport.prototype.send = function(mail, cb) {
    this.data = this.sb.transformData(mail.data);
    cb();
};

MockTransport.prototype.reset = function() {
    this.data = undefined;
};

var mock = new MockTransport(sendinblue({
    apiKey: "dummy",
    apiUrl: "dummy"
}));
var transport = nodemailer.createTransport(mock);


describe("SendinBlueTransport", function () {
    describe("#transformData", function () {
        beforeEach(function () {
            mock.reset();
        });

        it("should parse plain 'from' address", function () {
            transport.sendMail({
                from: "example@test.net"
            });

            assert.deepStrictEqual(mock.data.from, ["example@test.net", ""]);
        });

        it("should parse 'from' address with name", function () {
            transport.sendMail({
                from: '"Doe, Jon" <example@test.net>'
            });

            assert.deepStrictEqual(mock.data.from, ["example@test.net", "Doe, Jon"]);
        });

        it("should parse 'from' address object", function () {
            transport.sendMail({
                from: { name: "Doe, Jon", address: "example@test.net" }
            });

            assert.deepStrictEqual(mock.data.from, ["example@test.net", "Doe, Jon"]);
        });

        it("should parse plain 'to' address", function () {
            transport.sendMail({
                to: "example@test.net, example2@test.net"
            });

            assert.deepStrictEqual(mock.data.to, {
                "example@test.net": "",
                "example2@test.net": ""
            });
        });

        it("should parse plain or named 'to' address", function () {
            transport.sendMail({
                to: ["example@test.net", '"Don, Joe" <example2@test.net>']
            });

            assert.deepStrictEqual(mock.data.to, {
                "example@test.net": "",
                "example2@test.net": "Don, Joe"
            });
        });

        it("should parse object 'to' address", function () {
            transport.sendMail({
                to: {address: "example@test.net", name: "Don Joe"}
            });

            assert.deepStrictEqual(mock.data.to, {"example@test.net": "Don Joe"});
        });

        it("should flatten address groups", function () {
            transport.sendMail({
                to: "AGroup: example@test.net, example2@test.net"
            });

            assert.deepStrictEqual(mock.data.to, {
                "example@test.net": "",
                "example2@test.net": ""
            });
        });

        it("should fill out all address fields", function () {
            transport.sendMail({
                from: "example@test.net",
                to: "example@test.net",
                cc: "example@test.net",
                bcc: "example@test.net",
                replyTo: "example@test.net"
            });

            assert.deepStrictEqual(mock.data.from, ["example@test.net", ""]);
            assert.deepStrictEqual(mock.data.to, {"example@test.net": ""});
            assert.deepStrictEqual(mock.data.cc, {"example@test.net": ""});
            assert.deepStrictEqual(mock.data.bcc, {"example@test.net": ""});
            assert.deepStrictEqual(mock.data.replyto, ["example@test.net", ""]);
        });
    });
});
