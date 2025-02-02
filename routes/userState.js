const express = require('express');
const router = express.Router();
const UserQuizState = require('../models/UserQuizState');
const QuizQuestion = require("../models/QuizQuestion");

const startDate = new Date('2025-02-01T00:00:00.000Z');

router.use((req, res, next) => {
    req.startDate = startDate; // Store in request object for use in queries
    next();
});

// Get users with their score as percentage
router.get('/users', async (req, res) => {
    try {
        // Fetch total number of quiz questions
        const totalQuestions = await QuizQuestion.countDocuments();

        if (totalQuestions === 0) {
            return res.status(404).json({ error: 'No quiz questions found' });
        }

        // Fetch all users
        const users = await UserQuizState.find({ createdAt: { $gte: req.startDate } });

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
        const totalUsers = await UserQuizState.countDocuments({createdAt: { $gte: req.startDate }  });
        const completedQuizzes = await UserQuizState.countDocuments({ quizCompleted: true, createdAt: { $gte: req.startDate }  });
        const verifiedUsers = await UserQuizState.countDocuments({ verified: true,createdAt: { $gte: req.startDate }  });

        const averageScoreData = await UserQuizState.aggregate([
            { $match: { quizCompleted: true, createdAt: { $gte: req.startDate }  } },
            { $group: { _id: null, avgScore: { $avg: "$score" } } },
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
                    score: { $gte: min, $lt: max },
                    createdAt: { $gte: req.startDate } 
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
        const today = new Date();
        const trend = await Promise.all([...Array(7)].map(async (_, i) => {
            const date = new Date();
            date.setDate(today.getDate() - (6 - i));
            date.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            const completions = await UserQuizState.countDocuments({
                quizCompleted: true,
                updatedAt: { $gte: date, $lte: end }
            });

            return { 
                // date: date.toISOString().split('T')[0], // YYYY-MM-DD format
                date: date.toLocaleDateString('en-US', { weekday: 'short' }), // e.g., "Sun", "Mon"
                completions
            };
        }));

        res.json(trend);
    } catch (err) {
        console.error('Error fetching completion trend:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
