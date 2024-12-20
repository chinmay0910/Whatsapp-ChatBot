const twilio = require('twilio');
const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail'); // Import the sendMail function
const { PDFDocument } = require('pdf-lib');
const { fetchQuizQuestions } = require('../controllers/questions');
const UserQuizState = require('../models/UserQuizState');

// Twilio configuration
const twilioAccountSid = process.env.TwilioAccountSid;
const twilioAuthToken = process.env.TwilioAuthToken;
const twilioPhoneNumber = process.env.TwilioPhoneNumber;
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

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

// Send certificate via Twilio
async function sendCertificate(userId, name, score, photoPath) {
    const { certificateFilePath, certId } = await generateCertificate(userId, name, score, photoPath);
    await twilioClient.messages.create({
        body: `Congratulations, ${name}! 🎉\nHere is your certificate for completing the quiz.\nCertificate ID: ${certId}`,
        from: twilioPhoneNumber,
        to: userId
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
    // Handle incoming messages
    client.on('message', async (message) => {
        const userId = message.from;
        const quizQuestions = await fetchQuizQuestions();

        // Check if the user has an existing state in the database
        let userState = await UserQuizState.findOne({ userId });

        if (userState && userState.quizCompleted) {
            await twilioClient.messages.create({
                body: "Quiz is already completed and your Certificate No is " + userState.certId,
                from: twilioPhoneNumber,
                to: userId
            });
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

            await twilioClient.messages.create({
                body: "Welcome to the Cybersecurity Quiz! Please enter your name to begin:",
                from: twilioPhoneNumber,
                to: userId
            });
        }
        // Get name
        else if (userState && !userState.name) {
            userState.name = message.body.trim();
            await userState.save();
            await twilioClient.messages.create({
                body: "Thank you! Please enter your email address for verification:",
                from: twilioPhoneNumber,
                to: userId
            });
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
                await twilioClient.messages.create({
                    body: 'An OTP has been sent to your email. Please enter the OTP to verify your email:',
                    from: twilioPhoneNumber,
                    to: userId
                });
            } else {
                await twilioClient.messages.create({
                    body: 'Invalid email format. Please try again.',
                    from: twilioPhoneNumber,
                    to: userId
                });
            }
        }
        // Verify OTP
        else if (userState && userState.otp && !userState.verified) {
            if (message.body === userState.otp) {
                userState.verified = true;
                await userState.save();
                await twilioClient.messages.create({
                    body: "Email verified successfully! Please upload your profile picture for generating the completion certificate.",
                    from: twilioPhoneNumber,
                    to: userId
                });
            } else {
                await twilioClient.messages.create({
                    body: "Invalid OTP. Please try again.",
                    from: twilioPhoneNumber,
                    to: userId
                });
            }
        }
        // Receive photo
        else if (userState && userState.verified && !userState.photoPath && message.hasMedia) {
            const media = await message.downloadMedia();
            const photoPath = `${photosPath}${userId}_photo.jpg`;
            fs.writeFileSync(photoPath, media.data, 'base64');
            userState.photoPath = photoPath;
            await userState.save();
            await twilioClient.messages.create({
                body: `Photo received! Let's start the quiz.\n${quizQuestions[0].question}\n${quizQuestions[0].options}`,
                from: twilioPhoneNumber,
                to: userId
            });
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

            // End quiz
            if (userState.questionIndex >= quizQuestions.length) {
                userState.quizCompleted = true;
                await userState.save();

                const certId = await sendCertificate(userId, userState.name, userState.score, userState.photoPath);
                await saveQuizResult(userState.name, userState.score, userState.email, certId);

                await twilioClient.messages.create({
                    body: `Quiz completed!\nYour certificate has been sent to you via SMS.\nYour Certificate No: ${certId}`,
                    from: twilioPhoneNumber,
                    to: userId
                });
            } else {
                await twilioClient.messages.create({
                    body: `${quizQuestions[userState.questionIndex].question}\n${quizQuestions[userState.questionIndex].options}`,
                    from: twilioPhoneNumber,
                    to: userId
                });
            }
        }
    });
};

module.exports = initializeBot;
