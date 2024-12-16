const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail'); // Import the sendMail function
const { PDFDocument } = require('pdf-lib');
const { fetchQuizQuestions } = require('../controllers/questions');
const UserQuizState = require('../models/UserQuizState');

const client = new Client({
    authStrategy: new LocalAuth()
});

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
    const templatePath = './public/certificate_template.pdf'; // Path to the PDF template
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

// Send certificate on WhatsApp
async function sendCertificate(userId, name, score, photoPath) {
    const { certificateFilePath, certId } = await generateCertificate(userId, name, score, photoPath);
    const media = MessageMedia.fromFilePath(certificateFilePath);
    await client.sendMessage(userId, media, {
        caption: `Congratulations, ${name}! 🎉\nHere is your certificate for completing the quiz.\nCertificate ID: ${certId}`
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

const initializeBot = () => {
    // Handle WhatsApp messages
    client.on('message', async (message) => {
        const userId = message.from;
        const quizQuestions = await fetchQuizQuestions();

        // Check if the user has an existing state in the database
        let userState = await UserQuizState.findOne({ userId });

        if (userState && userState.quizCompleted) {
            client.sendMessage(userId, "Quiz is already completed and your Certificate No is " + userState.certId);
            return;
        }

        const quizStartTriggers = ['quiz', 'hey', 'hello', 'start', 'begin', 'hi bot', 'hey bot', 'hello bot', 'hi'];

        // Start quiz
        if (quizStartTriggers.includes(message.body.toLowerCase()) && !userState) {
            userState = new UserQuizState({
                userId,
                name: '',
                email: '',
                otp: '',
                verified: false,
                score: 0,
                questionIndex: 0,
                photoPath: '',
            });
            await userState.save();

            client.sendMessage(userId, "Welcome to the Cybersecurity Quiz! Please enter your name to begin:");
        }
        // Get name
        else if (userState && !userState.name) {
            userState.name = message.body.trim();
            await userState.save();
            client.sendMessage(userId, "Thank you! Please enter your email address for verification:");
        }
        // Get email and send OTP
        else if (userState && userState.name && !userState.email) {
            const email = message.body.trim();
            if (isValidEmail(email)) {
                const otp = generateOtp();
                userState.email = email;
                userState.otp = otp;
                await userState.save();

                sendMail(email, 'Quiz OTP Verification', `<p>Your OTP is: <strong>${otp}</strong></p>`);
                client.sendMessage(userId, 'An OTP has been sent to your email. Please enter the OTP to verify your email:');
            } else {
                client.sendMessage(userId, 'Invalid email format. Please try again.');
            }
        }
        // Verify OTP
        else if (userState && userState.otp && !userState.verified) {
            if (message.body === userState.otp) {
                userState.verified = true;
                await userState.save();
                client.sendMessage(userId, "Email verified successfully! Please upload your profile picture for generating the completion certificate.");
            } else {
                client.sendMessage(userId, "Invalid OTP. Please try again.");
            }
        }
        // Receive photo
        else if (userState && userState.verified && !userState.photoPath && message.hasMedia) {
            const media = await message.downloadMedia();
            const photoPath = `${photosPath}${userId}_photo.jpg`;
            fs.writeFileSync(photoPath, media.data, 'base64');
            userState.photoPath = photoPath;
            await userState.save();
            client.sendMessage(userId, "Photo received! Let's start the quiz.\n" + quizQuestions[0].question + "\n" + quizQuestions[0].options);
        }
        // Handle quiz answers
        else if (userState && userState.verified && userState.photoPath) {
            const currentQuestionIndex = userState.questionIndex;
            const correctAnswer = quizQuestions[currentQuestionIndex].answer;

            // Check answer
            if (message.body.toUpperCase() === correctAnswer) {
                userState.score++;
            }

            userState.questionIndex++;

            // Save updated state
            await userState.save();

            // Send next question or complete quiz
            if (userState.questionIndex < quizQuestions.length) {
                const nextQuestionIndex = userState.questionIndex;
                client.sendMessage(userId, quizQuestions[nextQuestionIndex].question + "\n" + quizQuestions[nextQuestionIndex].options);
            } else {
                // Quiz complete, generate and send certificate
                const finalScore = userState.score;
                const name = userState.name;
                const email = userState.email;

                client.sendMessage(userId, `Quiz complete! Your score: ${finalScore}/${quizQuestions.length}`);
                const certId = await sendCertificate(userId, name, finalScore, userState.photoPath);
                if (certId) {
                    saveQuizResult(name, finalScore, email, certId);
                }

                // Delete user state after quiz completion
                userState.quizCompleted = true;
                await userState.save();
            }
        }
    });

    // WhatsApp client initialization
    client.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
        console.log('Scan this QR code to log in to WhatsApp.');
    });

    client.on('ready', () => {
        console.log('WhatsApp client is ready.');
    });

    client.initialize();
};

module.exports = initializeBot;
