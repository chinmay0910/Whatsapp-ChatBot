const express = require('express');
const twilio = require('twilio');
const connectToMongo = require('./db')
const initializeBot = require('./bot/NoPaymentBot');
const questionRoutes = require('./routes/questionRoutes');
const UserQuizState = require('./models/UserQuizState');
const Payment = require('./models/Payment');
const path = require('path');
const handleIncomingMessage = require('./utils/handleWhatsappAPIMsg');
const axios = require('axios');

// contollers
const { signinPage, createUser, login, getUser } = require("./controllers/signin");
const quizRoutes = require("./routes/userState");
const fetchuser = require('./middleware/fetchuser');

const app = express();

app.use(express.json());

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

// handling static files 
app.use(express.static(path.join(process.cwd(), 'publicscripts')));

app.use("/uploads", express.static("uploads"));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectToMongo();

// Use routes
app.use('/questions', fetchuser, questionRoutes);

// API Routes
// handle webhook trigger
app.post('/', async (req, res) => {
    try {
      // Extract payment data from the request body
      const paymentData = req.body.payload?.payment?.entity;
      
      if (!paymentData) {
        return res.status(400).json({ message: 'Invalid payment data received' });
      }
  
      const { id: transactionId, amount, status, vpa } = paymentData;
      const email = paymentData.email || paymentData.notes?.email;
      const contact = paymentData.notes?.phone;
      const mobileNo = contact; // Remove country code if necessary assumming no country code is added
      console.log(paymentData);
      
      // Validation: Ensure required fields are present
      if (!transactionId || !amount || !status || !contact) {
        return res.status(400).json({ message: 'Missing required payment details' });
      }
  
      // Find the user by mobile number or email using $or operator to check either field
      const userState = await UserQuizState.findOne({
        $or: [
          { userId: { $regex: mobileNo, $options: 'i' } }, // Search for mobile number in userId
          { userId: { $regex: email, $options: 'i' } }, // Search for email in userId
        ]
      });
  
      if (!userState) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Create the Payment document
      const payment = new Payment({
        transactionId,
        amount,
        status,
        userId: userState._id,
        mobileNo,
        refId: vpa, // Use vpa as reference ID
      });
  
      // Save the payment to the database
      await payment.save();
  
      // Respond with success
      res.status(200).json({ message: 'Payment recorded successfully' });
    } catch (error) {
      console.error('Error processing payment webhook:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  

app.get('/view-questions', async (req, res) => {
    res.render('Question.ejs');  // This will render templates/index.ejs
});


app.get('/signinpage', (req, res) => {
  res.render('SigninPage.ejs')
})

app.get('/', (req, res) => {
  res.render('Dashboard.ejs')
})

app.get('/users', (req, res) => {
  res.render('User.ejs')
})


app.get('/signin', signinPage)
app.post('/createuser', createUser)
app.post('/login', login)
app.get('/getuser', fetchuser, getUser)
app.use("/api/quiz", fetchuser, quizRoutes);


/* const twilioAccountSid = process.env.TwilioAccountSid;
const twilioAuthToken = process.env.TwilioAuthToken;
// const twilioPhoneNumber = process.env.TwilioPhoneNumber;
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

app.post('/twilioDemo', async (req, res)=>{
  const sender = req.body.From; // Sender's phone number
  const message = req.body; // Incoming message text

  console.log(`Message received from ${sender}: ${message.Body}`);

  handleTwilioMessage(twilioClient, sender, message);

  res.status(200).send('Message sent');
})
*/
// Initialize WhatsApp Bot
// initializeBot();

// Direct Business API integration
app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let challenge = req.query["hub.challenge"];
  let token = req.query["hub.verify_token"];
  
  const mytoken = process.env.MYTOKEN; // Your verification token

  console.log(`Mode: ${mode}, Token: ${token}, MyToken: ${mytoken}, Challenge: ${challenge}`);
  

  if (mode && token) {
    if (mode === "subscribe" && token === mytoken) {
      res.status(200).send(challenge); // Respond with the challenge
    } else {
      res.status(403).send('Forbidden'); // Respond with a 403 if token doesn't match
    }
  } else {
    res.status(400).send('Bad Request'); // Respond with a 400 if mode or token is missing
  }
});

// Function to handle sending a reply to a user
/*const sendMessage = async (phoneNumberId, from, text) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v13.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: text },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ACCESS_TOKEN}`, // Include bearer token in the header
        },
      }
    );
    console.log('Message sent:', response.data);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw new Error('Failed to send message');
  }
};*/

// Main webhook handler
app.post('/webhook', async (req, res) => {
  try {
    console.log('Incoming Webhook Payload:', JSON.stringify(req.body, null, 2));

    const entry = req.body?.entry?.[0];
    if (!entry) {
      console.error('Invalid payload: Missing entry');
      return res.status(400).send({ error: 'Invalid payload: Missing entry' });
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      console.error('Invalid payload: Missing changes');
      return res.status(404).send({ error: 'Invalid payload: Missing changes' });
    }

    const value = changes.value;
    const messageData = value.messages?.[0];
    if (!messageData) {
      console.error('Invalid payload: Missing message data');
      return res.status(404).send({ error: 'Invalid payload: Missing message data' });
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    const from = messageData.from;
    const msg = messageData.text?.body || '';
    const messageType = messageData.type;

    console.log(`Received message from ${from}: ${msg}`);
    console.log(`Message Type: ${messageType}`);

    // Handle message based on type
    switch (messageType) {
      case 'text':
        console.log('Processing text message');
        handleIncomingMessage(from, msg, null);
        break;
      case 'image':
        console.log('Processing image message');
        handleIncomingMessage(from, msg, messageData.image);
        break;
      default:
        console.log(`Unsupported message type: ${messageType}`);
    }

    res.status(200).send({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Error handling webhook:', error.message);
    res.status(500).send({ error: 'Internal Server Error', details: error.message });
  }
});


app.listen(3000, () => console.log('API server running on http://localhost:3000'));