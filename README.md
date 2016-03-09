# Sendinblue Transport Module for Nodemailer

This module applies for [Nodemailer](http://www.nodemailer.com/) v1+ and provides a transport for [Sendinblue](https://www.sendinblue.com).

## Usage

Install with npm

    npm install nodemailer-sendinblue-transport

Require the module

```javascript
var nodemailer = require('nodemailer');
var SendinblueTransport = require('nodemailer-sendinblue-transport');
```

Create a Nodemailer transporter

```javascript
var transporter = nodemailer.createTransport(new SendinblueTransport(options))
```

### Available Options

* **apiKey** - Sendinblue API key

## License

**MIT**
