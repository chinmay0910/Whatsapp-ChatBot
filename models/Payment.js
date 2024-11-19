const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserQuizState', required: true },
  mobileNo: { type: String, required: true }, // Mobile number for reference
  refId: { type: String, required: true }, // Reference ID to link to user
  date: { type: Date, default: Date.now },
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;