const express = require('express');
const connectToMongo = require('./db')
const initializeBot = require('./bot/NoPaymentBot');
const questionRoutes = require('./routes/questionRoutes');
const UserQuizState = require('./models/UserQuizState');
const Payment = require('./models/Payment');
const path = require('path')

const app = express();

app.use(express.json());


// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

// Connect to MongoDB
connectToMongo();

// Use routes
app.use('/questions', questionRoutes);

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
  

app.get('/', async (req, res) => {
    res.render('index');  // This will render templates/index.ejs
});

app.post('/twilioDemo',(req, res)=>{
  console.log(req);
  

  res.status(200).send('Message sent');
})

// Initialize WhatsApp Bot
// initializeBot();

app.listen(3000, () => console.log('API server running on http://localhost:3000'));