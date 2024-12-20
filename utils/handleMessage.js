const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail'); // Import the sendMail function
const { PDFDocument } = require('pdf-lib');
const { fetchQuizQuestions } = require('../controllers/questions');
const UserQuizState = require('../models/UserQuizState');
const axios = require('axios');
const path = require('path');

const twilioPhoneNumber = process.env.TwilioPhoneNumber;

// Directory for storing certificates and temporary photos
const certificatesPath = './uploads/certificates/';
const photosPath = './uploads/photos/';
if (!fs.existsSync(certificatesPath)) {
    fs.mkdirSync(certificatesPath);
}
if (!fs.existsSync(photosPath)) {
    fs.mkdirSync(photosPath);
}

// Excel file setup
const filePath = './QuizResults.xlsx';
let workbook;
if (fs.existsSync(filePath)) {
    workbook = xlsx.readFile(filePath);
} else {
    workbook = xlsx.utils.book_new();
    workbook.SheetNames.push('Quiz Results');
    workbook.Sheets['Quiz Results'] = xlsx.utils.aoa_to_sheet([['Name', 'Score', 'Email', 'Date', 'Certificate ID']]);
    xlsx.writeFile(workbook, filePath);
}

// Function to generate OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Validate Email
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Generate certificate using PDF template
async function generateCertificate(userId, name, score, photoPath) {
    const templatePath = './public/certificate_template.pdf';
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const quizQuestions = await fetchQuizQuestions();

    // Populate form fields
    form.getTextField('name').setText(name);
    form.getTextField('score').setText(`${score} / ${quizQuestions.length}`);
    const certId = crypto.randomBytes(4).toString('hex');
    form.getTextField('certificateId').setText(certId);
    form.getTextField('date').setText(new Date().toLocaleDateString());

    // Add the user photo to the PDF if it exists
    if (photoPath && fs.existsSync(photoPath)) {
        const photoBytes = fs.readFileSync(photoPath);
        const photoImage = await pdfDoc.embedJpg(photoBytes);
        const photoDimensions = photoImage.scale(0.5);
        const page = pdfDoc.getPage(0);
        page.drawImage(photoImage, {
            x: 603, // Adjust X position
            y: 282, // Adjust Y position
            width: 150,
            height: 150
        });
    }

    // Flatten the form fields to make them non-editable
    form.flatten();

    // Save the PDF to a file
    const certificateFilePath = `${certificatesPath}${userId}_certificate.pdf`;
    const pdfBytesOutput = await pdfDoc.save();
    fs.writeFileSync(certificateFilePath, pdfBytesOutput);

    return { certificateFilePath, certId };
}

// Send message via Twilio WhatsApp
async function sendWhatsAppMessage(twilioClient, to, body) {
    await twilioClient.messages.create({
        body,
        from: twilioPhoneNumber,
        to
    });
}

// Send certificate via Twilio WhatsApp
async function sendCertificate(userId, name, score, photoPath) {
    const { certificateFilePath, certId } = await generateCertificate(userId, name, score, photoPath);
    // const mediaUrl = `https://whatsapp-chatbot-em4i.onrender.com/uploads/certificates/${userId}_certificate.pdf`; // Update with your server URL
    const mediaUrl = certificateFilePath; // Update with your server URL

    await twilioClient.messages.create({
        body: `Congratulations, ${name}! 🎉\nHere is your certificate for completing the quiz.\nCertificate ID: ${certId}`,
        from: twilioPhoneNumber,
        to: userId,
        mediaUrl
    });

    return certId;
}

// Save quiz result to Excel
async function saveQuizResult(name, score, email, certId) {
    const worksheet = workbook.Sheets['Quiz Results'];
    const newRow = [name, score, email, new Date().toLocaleString(), certId];
    xlsx.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });
    xlsx.writeFile(workbook, filePath);
    const user = await UserQuizState.findOne({ name });
    user.certId = certId;
    await user.save();
}

// Handle Twilio incoming messages
async function handleTwilioMessage(client, sender, messageBody) {
    const message = messageBody.Body;
    const quizQuestions = await fetchQuizQuestions();
    let userState = await UserQuizState.findOne({ userId: sender });

    if (message.toLowerCase() === 'restart') {
        if (userState) {
            await UserQuizState.deleteOne({ userId: sender });
            await sendWhatsAppMessage(client, sender, 'Your quiz has been restarted. Type "quiz" or "start" to begin again.');
        } else {
            await sendWhatsAppMessage(client, sender, 'You are not currently taking a quiz. Type "quiz" or "start" to begin.');
        }
        return;
    }

    if (userState && userState.quizCompleted) {
        await sendWhatsAppMessage(client, sender, `Quiz is already completed. Your Certificate ID is ${userState.certId}`);
        return;
    }

    const quizStartTriggers = ['quiz', 'hey', 'hello', 'start', 'begin', 'hi bot', 'hey bot', 'hello bot', 'hi'];

    if (quizStartTriggers.includes(message.toLowerCase()) && !userState) {
        userState = new UserQuizState({
            userId: sender,
            name: '',
            email: '',
            otp: '',
            verified: false,
            score: 0,
            questionIndex: 0,
            photoPath: ''
        });
        await userState.save();

        await sendWhatsAppMessage(client, sender, 'Welcome to the Cybersecurity Quiz! Please enter your name to begin:');
    } else if (userState && !userState.name) {
        userState.name = message.trim();
        await userState.save();
        await sendWhatsAppMessage(client, sender, 'Thank you! Please enter your email address for verification:');
    } else if (userState && userState.name && !userState.email) {
        const email = message.trim();
        if (isValidEmail(email)) {
            const otp = generateOtp();
            userState.email = email;
            userState.otp = otp;
            await userState.save();

            sendMail(email, 'Quiz OTP Verification', `<p>Your OTP is: <strong>${otp}</strong></p>`);
            await sendWhatsAppMessage(client, sender, 'An OTP has been sent to your email. Please enter the OTP to verify your email:');
        } else {
            await sendWhatsAppMessage(client, sender, 'Invalid email format. Please try again.');
        }
    } else if (userState && userState.otp && !userState.verified) {
        if (message === userState.otp) {
            userState.verified = true;
            await userState.save();
            await sendWhatsAppMessage(client, sender, 'Email verified successfully! Please upload your profile picture for generating the completion certificate.');
        } else {
            await sendWhatsAppMessage(client, sender, 'Invalid OTP. Please try again.');
        }
    }
    else if (userState && userState.verified && !userState.photoPath && messageBody.MediaUrl0) {
        const mediaUrl = messageBody.MediaUrl0;
        console.log(mediaUrl);
        
        const imagePath = path.join(photosPath, `${sender}_photo.jpg`);

        // Download the image
        const imageBuffer = await await axios.get(mediaUrl, {
            responseType: 'arraybuffer',
            headers: {
                // Include authorization header if required
                Authorization: `Bearer ${process.env.TwilioAuthToken}`
            }
        });

        console.log(imageBuffer);
        
        fs.writeFileSync(imagePath, imageBuffer.data);

        // Save this image path to the user state or database if necessary
        const userState = await UserQuizState.findOne({ userId: sender });
        userState.photoPath = imagePath;
        await userState.save();

        client.sendMessage(userId, "Photo received! Let's start the quiz.\n" + quizQuestions[0].question + "\n" + quizQuestions[0].options);
    }
    else if (userState && userState.verified && userState.photoPath && message) {
        const currentQuestionIndex = userState.questionIndex;
        const correctAnswer = quizQuestions[currentQuestionIndex].answer;

        if (message.toUpperCase() === correctAnswer) {
            userState.score++;
        }

        userState.questionIndex++;
        await userState.save();

        if (userState.questionIndex < quizQuestions.length) {
            const nextQuestionIndex = userState.questionIndex;
            await sendWhatsAppMessage(client, sender, quizQuestions[nextQuestionIndex].question + '\n' + quizQuestions[nextQuestionIndex].options);
        } else {
            const finalScore = userState.score;
            const name = userState.name;
            const email = userState.email;

            await sendWhatsAppMessage(client, sender, `Quiz complete! Your score: ${finalScore}/${quizQuestions.length}`);
            const certId = await sendCertificate(sender, name, finalScore, userState.photoPath);
            if (certId) {
                saveQuizResult(name, finalScore, email, certId);
            }

            userState.quizCompleted = true;
            await userState.save();
        }
    }
}

module.exports = handleTwilioMessage;
