// models/UserQuizState.js
const mongoose = require('mongoose');

const userQuizStateSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    otp: String,
    verified: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    questionIndex: { type: Number, default: 0 },
    photoPath: String,
    certId: String,
    paymentVerified: { type: Boolean, default: false },
}, { timestamps: true });

const UserQuizState = mongoose.model('UserQuizState', userQuizStateSchema);

module.exports = UserQuizState;
