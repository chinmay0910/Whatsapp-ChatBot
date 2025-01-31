const express = require('express');
const router = express.Router();
const UserQuizState = require('../models/UserQuizState');
const QuizQuestion = require("../models/QuizQuestion");

// Get users with their score as percentage
router.get('/users', async (req, res) => {
    try {
        // Fetch total number of quiz questions
        const totalQuestions = await QuizQuestion.countDocuments();

        if (totalQuestions === 0) {
            return res.status(404).json({ error: 'No quiz questions found' });
        }

        // Fetch all users
        const users = await UserQuizState.find({});

        // Calculate the score percentage for each user
        const modifiedUsers = users.map(user => {
            const correctAnswers = user.score || 0; // Assuming `score` is the number of correct answers

            // Calculate the score percentage
            const scorePercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

            // Return user data along with calculated score percentage
            return {
                ...user._doc, // Include other user fields
                score: Math.round(scorePercentage) // Round to nearest integer
            };
        });

        res.json(modifiedUsers);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
    try {
        const totalUsers = await UserQuizState.countDocuments();
        const completedQuizzes = await UserQuizState.countDocuments({ quizCompleted: true });
        const verifiedUsers = await UserQuizState.countDocuments({ verified: true });

        const averageScoreData = await UserQuizState.aggregate([
            { $match: { quizCompleted: true } },
            { $group: { _id: null, avgScore: { $avg: "$score" } } }
        ]);
        const averageScore = averageScoreData.length > 0 ? averageScoreData[0].avgScore.toFixed(2) : 0;

        res.json({ totalUsers, completedQuizzes, verifiedUsers, averageScore });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get score distribution
router.get("/score-distribution", async (req, res) => {
    try {
        // Fetch total number of quiz questions
        const totalQuestions = await QuizQuestion.countDocuments();
        if (totalQuestions === 0) {
            return res.json({ error: "No quiz questions found." });
        }

        // Define score ranges based on number of questions
        const rangeSize = Math.ceil(totalQuestions / 5); // Split into 5 equal ranges
        const ranges = Array.from({ length: 5 }, (_, i) => ({
            min: i * rangeSize,
            max: (i + 1) * rangeSize
        }));

        // Calculate score distribution dynamically
        const distribution = await Promise.all(
            ranges.map(async ({ min, max }) => {
                const count = await UserQuizState.countDocuments({
                    score: { $gte: min, $lt: max }
                });
                return { score: `${min}-${max}`, count };
            })
        );

        res.json(distribution);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// Get quiz completion trend (last 7 days)
router.get('/completion-trend', async (req, res) => {
    try {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        
        const trend = await Promise.all(days.map(async (day, index) => {
            const start = new Date();
            start.setDate(today.getDate() - (6 - index));
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            
            const completions = await UserQuizState.countDocuments({ quizCompleted: true, updatedAt: { $gte: start, $lte: end } });
            return { date: day, completions };
        }));

        res.json(trend);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
