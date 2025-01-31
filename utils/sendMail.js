const nodemailer = require('nodemailer');
require('dotenv').config();

const sendMail = (receiver, subject, body) => {
    // create reusable transporter
    let transporter = nodemailer.createTransport({
        host: "smtp.mailgun.org",
        port: 587,
        auth: {
            user: process.env.USER,
            pass: process.env.APP_PASS
        }
    });

    const mailOptions = {
        from: {
            name: "National Cyber Security Conclave",
            address: process.env.USER
        },
        to: receiver,
        subject: subject,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
    <style>
        body {
            font-family: sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            max-width: 600px;
            width: 90%;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header img {
            max-width: 200px; /* Adjust as needed */
        }

        .content {
            text-align: center;
        }

        .code {
            font-size: 2em;
            font-weight: bold;
            color: #007bff; /* Or your brand color */
            padding: 10px 20px;
            border: 2px dashed #007bff; /* Or your brand color */
            border-radius: 5px;
            margin: 20px auto;
            display: inline-block;
            letter-spacing: 8px; /* Adjust spacing as needed */
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            color: #777;
            font-size: 0.8em;
        }

        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #007bff; /* Your brand color */
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin-top: 20px;
        }

        .disclaimer {
          font-size: smaller;
          color: gray;
          margin-top: 20px;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <!--         <img src="your_logo.png" alt="Your Logo"> --></div>

    <div class="content">
        <h1>Verify Your Email</h1>
        <p>Thank you for registering for the National Cybersecurity Conclave! Please use the following verification code to complete your registration:</p>
        <div class="code">${body}</div>
        <p>If you did not request this verification, please ignore this email.</p>

        <a href="https://wa.me/917692069207?text=${body}" class="button">Verify Now</a>
    </div>

    <div class="footer">
        <p>&copy;Crysalen. All rights reserved.</p>
    </div>
</div>

</body>
</html>`,
    };

    const sendMail = async (transporter, mailOptions, email) => {
        try {
            await transporter.sendMail(mailOptions);
            console.log(email + " Email Sent Successfully...");
        } catch (error) {
            console.error(error);
        }
    };

    sendMail(transporter, mailOptions, receiver);
};

module.exports = sendMail;
