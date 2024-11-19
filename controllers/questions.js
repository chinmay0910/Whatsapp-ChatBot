const mongoose = require('mongoose');
const QuizQuestion = require('../models/QuizQuestion');

async function fetchQuizQuestions() {
    try {
        const questions = await QuizQuestion.find(); // Fetch all questions
        return questions;
    } catch (error) {
        console.error('Error fetching quiz questions:', error);
        return [];
    }
}

module.exports = {
    fetchQuizQuestions
}