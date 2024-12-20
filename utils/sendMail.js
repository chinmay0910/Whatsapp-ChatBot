const nodemailer = require('nodemailer');
require('dotenv').config();

const smtpTransport = require("nodemailer-smtp-transport");

const sendMail = (receiver, subject, body) => {
    // create reusable transporter
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // use TLS
        auth: {
            user: process.env.USER,
            pass: process.env.APP_PASS
        }
    });

    const mailOptions = {
        from: {
            name: "Hacktify",
            address: process.env.USER
        },
        to: receiver,
        subject: subject,
        html: body,
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
