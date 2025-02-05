const mongoose = require('mongoose');

const userConfirmationSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  designation: { type: String },
  institute: { type: String },
  // step indicates which field we are currently collecting:
  // 0: waiting for name, 1: waiting for email, 2: waiting for designation,
  // 3: waiting for institute, 4: confirmation completed.
  step: { type: Number, default: 0 }
});

module.exports = mongoose.model('UserConfirmation', userConfirmationSchema);
