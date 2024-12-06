const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const sendMail = require('./utils/sendMail'); // Import the sendMail function
const { PDFDocument } = require('pdf-lib');

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

// Quiz questions and answers
const quizQuestions = [
    {
        question: "What is the primary goal of cybersecurity?",
        options: "A) To make systems run faster\nB) To protect data and systems from threats\nC) To develop new software\nD) To increase network speed",
        answer: "B"
    },
    {
        question: "Which of the following is an example of malware?",
        options: "A) Anti-virus software\nB) Firewall\nC) Ransomware\nD) VPN",
        answer: "C"
    }
    // Add more questions as needed
];

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

// Generate certificate using PDF template
async function generateCertificate(userId, name, score, photoPath) {
    const templatePath = './public/certificate_template.pdf'; // Path to the PDF template
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

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
function saveQuizResult(name, score, email, certId) {
    const worksheet = workbook.Sheets['Quiz Results'];
    const newRow = [name, score, email, new Date().toLocaleString(), certId];
    xlsx.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });
    xlsx.writeFile(workbook, filePath);
}

// User quiz state to track progress
let userQuizState = {};

// Handle WhatsApp messages
client.on('message', async message => {
    const userId = message.from;

    // Start quiz
    if (message.body.toLowerCase() === 'quiz' && !userQuizState[userId]) {
        userQuizState[userId] = {
            questionIndex: 0,
            score: 0,
            name: '',
            email: '',
            otp: '',
            verified: false,
            photoPath: ''
        };
        client.sendMessage(userId, "Welcome to the Cybersecurity Quiz! Please enter your name to begin:");
    }
    // Get name
    else if (userQuizState[userId] && !userQuizState[userId].name) {
        userQuizState[userId].name = message.body;
        client.sendMessage(userId, "Thank you! Please enter your email address for verification:");
    }
    // Get email and send OTP
    else if (userQuizState[userId] && userQuizState[userId].name && !userQuizState[userId].email) {
        const email = message.body;
        userQuizState[userId].email = email;
        const otp = generateOtp();
        userQuizState[userId].otp = otp;

        // Send OTP
        sendMail(email, "Quiz OTP Verification", `<p>Your OTP is: <strong>${otp}</strong></p>`);
        client.sendMessage(userId, "An OTP has been sent to your email. Please enter the OTP to verify your email:");
    }
    // Verify OTP
    else if (userQuizState[userId] && userQuizState[userId].otp && !userQuizState[userId].verified) {
        if (message.body === userQuizState[userId].otp) {
            userQuizState[userId].verified = true;
            client.sendMessage(userId, "Email verified successfully! Please send a photo to be added to your certificate.");
        } else {
            client.sendMessage(userId, "Invalid OTP. Please try again.");
        }
    }
    // Receive photo
    else if (userQuizState[userId] && userQuizState[userId].verified && !userQuizState[userId].photoPath && message.hasMedia) {
        const media = await message.downloadMedia();
        const photoPath = `${photosPath}${userId}_photo.jpg`;
        fs.writeFileSync(photoPath, media.data, 'base64');
        userQuizState[userId].photoPath = photoPath;
        client.sendMessage(userId, "Photo received! Let's start the quiz.\n" + quizQuestions[0].question + "\n" + quizQuestions[0].options);
    }
    // Handle quiz answers
    else if (userQuizState[userId] && userQuizState[userId].verified && userQuizState[userId].photoPath) {
        const currentQuestionIndex = userQuizState[userId].questionIndex;
        const correctAnswer = quizQuestions[currentQuestionIndex].answer;

        // Check answer
        if (message.body.toUpperCase() === correctAnswer) {
            userQuizState[userId].score++;
        }

        userQuizState[userId].questionIndex++;

        // Send next question or complete quiz
        if (userQuizState[userId].questionIndex < quizQuestions.length) {
            const nextQuestionIndex = userQuizState[userId].questionIndex;
            client.sendMessage(userId, quizQuestions[nextQuestionIndex].question + "\n" + quizQuestions[nextQuestionIndex].options);
        } else {
            // Quiz complete, generate and send certificate
            const finalScore = userQuizState[userId].score;
            const name = userQuizState[userId].name;
            const email = userQuizState[userId].email;

            client.sendMessage(userId, `Quiz complete! Your score: ${finalScore}/${quizQuestions.length}`);
            const certId = await sendCertificate(userId, name, finalScore, userQuizState[userId].photoPath);
            if (certId) {
                saveQuizResult(name, finalScore, email, certId);
            }
            delete userQuizState[userId];
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
