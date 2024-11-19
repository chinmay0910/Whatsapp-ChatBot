// routes/questionRoutes.js
const express = require('express');
const router = express.Router();
const Question = require('../models/QuizQuestion');  // Import the Question model

// 1. Add a new question
router.post('/add', async (req, res) => {
    const { question, options, answer } = req.body;

    if (!question || !options || !answer) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Create a new question document
        const newQuestion = new Question({
            question,
            options,
            answer
        });

        // Save the question to the database
        await newQuestion.save();

        return res.status(201).json({ message: 'Question added successfully', question: newQuestion });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error saving question', error: err.message });
    }
});

// 2. Edit an existing question
router.put('/edit/:id', async (req, res) => {
    const { id } = req.params;  // Get the question ID from the URL
    const { question, options, answer } = req.body;

    if (!question || !options || !answer) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Find the question by ID and update it
        const updatedQuestion = await Question.findByIdAndUpdate(id, { question, options, answer }, { new: true });

        if (!updatedQuestion) {
            return res.status(404).json({ message: 'Question not found' });
        }

        return res.status(200).json({ message: 'Question updated successfully', question: updatedQuestion });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error updating question', error: err.message });
    }
});

// 3. Delete a question
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;  // Get the question ID from the URL

    try {
        // Find the question by ID and delete it
        const deletedQuestion = await Question.findByIdAndDelete(id);

        if (!deletedQuestion) {
            return res.status(404).json({ message: 'Question not found' });
        }

        return res.status(200).json({ message: 'Question deleted successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error deleting question', error: err.message });
    }
});

module.exports = router;
