const xlsx = require('xlsx');
const fs = require('fs');
const crypto = require('crypto');
const sendMail = require('../utils/sendMail'); // Import the sendMail function
const { PDFDocument } = require('pdf-lib');
const { fetchQuizQuestions } = require('../controllers/questions');
const UserQuizState = require('../models/UserQuizState');
const axios = require('axios');
const path = require('path');

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

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;
const Auth_token = process.env.WHATSAPP_API_TOKEN;
// Send message via WhatsApp Business API
async function sendWhatsAppMessage(to, body, mediaID = null) {
    const data = {
        messaging_product: 'whatsapp',
        to,
        text: {
            body
        }
    };

    if (mediaID) {
        data.type = 'document' // or 'document' for PDFs
        data.document = {
            id: mediaID,
        };
    }

    try {
        await axios.post(`https://graph.facebook.com/v14.0/${PHONE_NUMBER_ID}/messages`, data, {
            headers: {
                'Authorization': `Bearer ${Auth_token}`,
                'Content-Type': 'application/json',
            }
        });
    } catch (error) {
        console.error('Error sending message via WhatsApp Business API:', error);
    }
}

// Send certificate via WhatsApp
async function sendCertificate(userId, name, score, photoPath) {
    const { certificateFilePath, certId } = await generateCertificate(userId, name, score, photoPath);
    const mediaUrl = `https://whatsapp-chatbot-em4i.onrender.com${certificateFilePath}`; // Update with your server URL
    const mediaId = await uploadMedia(mediaUrl, 'application/pdf');
    await sendWhatsAppMessage(userId, `Congratulations, ${name}! 🎉\nHere is your certificate for completing the quiz.\nCertificate ID: ${certId}`, mediaId);

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

async function sendGetRequest(id) {
    const newurl = "https://graph.facebook.com/v14.0/" + id;
    try {
        const response = await axios.get(newurl, {
            headers: {
                "Authorization": "Bearer " +  Auth_token// Add your Token to the header of the API request
            }
        });

        console.log("Full API Response:", response.data); // Log the full response

        if (response.data && response.data.url) {
            const mediaURL = response.data.url;

            // Check if mime_type exists, log if undefined
            const mediaMimeType = response.data.mime_type || "unknown";
            if (mediaMimeType === "unknown") {
                console.warn("Mime type is missing in the API response");
            }

            console.log("Response from Graph V14.0 - Image URL:", mediaURL);
            console.log("Mime type:", mediaMimeType);

            return await sendImgDownload(mediaURL, mediaMimeType, id);
        } else {
            console.log("Unexpected response format:", response.data);
        }
    } catch (error) {
        console.error("Error saving image from sendGetRequest:", error.message);
    }
}

async function sendImgDownload(mediaURL, mediaMimeType, id) {
    const filename = `WA_${id}`;
    console.log("mediaURL:", mediaURL);
    console.log("mediaMimeType:", mediaMimeType);

    try {
        const response = await axios.get(mediaURL, {
            headers: {
                'Authorization': `Bearer ${Auth_token}`,
                'Content-Type': mediaMimeType,
            },
            responseType: 'arraybuffer', // This is important for binary data
        });

        if (response.data) {
            if (mediaMimeType.startsWith("image/")) {
                const photosPath = './uploads/photos/';
                const fileExtension = `${photosPath}${filename}.${mediaMimeType.split('/')[1]}`;
                const imageData = Buffer.from(response.data, 'binary');

                await fs.writeFileSync(fileExtension, imageData);

                console.log(`Media saved to ${fileExtension} successfully.`);
                return fileExtension;
            } else {
                console.warn("Invalid mime type for an image:", mediaMimeType);
            }
        } else {
            console.error("Empty response data received.");
        }
    } catch (error) {
        console.error("Error downloading media:", error.message);
    }
}

async function uploadMedia(filePath, mimeType) {
    try {
        const url = `https://graph.facebook.com/v14.0/${PHONE_NUMBER_ID}/media`;
        const fileStream = fs.createReadStream(filePath);

        const formData = new FormData();
        formData.append('file', fileStream);
        formData.append('type', mimeType);

        const response = await axios.post(url, formData, {
            headers: {
                Authorization: `Bearer ${Auth_token}`,
                ...formData.getHeaders(),
            },
        });

        return response.data.id; // media_id
    } catch (error) {
        console.error('Error uploading media:', error.message);
        throw error;
    }
}

// Handle WhatsApp incoming messages
async function handleIncomingMessage(sender, messageBody, imageData) {
    const message = messageBody;
    const quizQuestions = await fetchQuizQuestions();
    let userState = await UserQuizState.findOne({ userId: sender });

    if (message.toLowerCase() === 'restart') {
        if (userState) {
            await UserQuizState.deleteOne({ userId: sender });
            await sendWhatsAppMessage(sender, 'Your quiz has been restarted. Type "quiz" or "start" to begin again.');
        } else {
            await sendWhatsAppMessage(sender, 'You are not currently taking a quiz. Type "quiz" or "start" to begin.');
        }
        return;
    }

    if (userState && userState.quizCompleted) {
        await sendWhatsAppMessage(sender, `Quiz is already completed. Your Certificate ID is ${userState.certId}`);
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

        await sendWhatsAppMessage(sender, 'Welcome to the Cybersecurity Quiz! Please enter your name to begin:');
    } else if (userState && !userState.name) {
        userState.name = message.trim();
        await userState.save();
        await sendWhatsAppMessage(sender, 'Thank you! Please enter your email address for verification:');
    } else if (userState && userState.name && !userState.email) {
        const email = message.trim();
        if (isValidEmail(email)) {
            const otp = generateOtp();
            userState.email = email;
            userState.otp = otp;
            await userState.save();

            sendMail(email, 'Quiz OTP Verification', `<p>Your OTP is: <strong>${otp}</strong></p>`);
            await sendWhatsAppMessage(sender, 'An OTP has been sent to your email. Please enter the OTP to verify your email:');
        } else {
            await sendWhatsAppMessage(sender, 'Invalid email format. Please try again.');
        }
    } else if (userState && userState.otp && !userState.verified) {
        if (message === userState.otp) {
            userState.verified = true;
            await userState.save();
            await sendWhatsAppMessage(sender, 'Email verified successfully! Please upload your profile picture for generating the completion certificate.');
        } else {
            await sendWhatsAppMessage(sender, 'Invalid OTP. Please try again.');
        }
    }
    else if (userState && userState.verified && !userState.photoPath && imageData != null) {
        const mediaID = imageData.id;
        console.log(mediaID);
        
        const imagePath = await sendGetRequest(mediaID);
        console.log("IMAGEPATH>> "+imagePath);
        
        // Save this image path to the user state or database if necessary
        const userState = await UserQuizState.findOne({ userId: sender });
        userState.photoPath = imagePath;
        await userState.save();

        await sendWhatsAppMessage(sender, "Photo received! Let's start the quiz.\n" + quizQuestions[0].question + "\n" + quizQuestions[0].options);
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
            await sendWhatsAppMessage(sender, quizQuestions[nextQuestionIndex].question + '\n' + quizQuestions[nextQuestionIndex].options);
        } else {
            const finalScore = userState.score;
            const name = userState.name;
            const email = userState.email;

            await sendWhatsAppMessage(sender, `Quiz complete! Your score: ${finalScore}/${quizQuestions.length}`);
            const certId = await sendCertificate(sender, name, finalScore, userState.photoPath);
            if (certId) {
                saveQuizResult(name, finalScore, email, certId);
            }

            userState.quizCompleted = true;
            await userState.save();
        }
    }
}

module.exports = handleIncomingMessage;
