// routes/questionRoutes.js
const express = require('express');
const router = express.Router();
const Question = require('../models/QuizQuestion');  // Import the Question model
const { fetchQuizQuestions } = require('../controllers/questions');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Set up Multer storage with unique filenames
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to store uploaded files
    },
    filename: (req, file, cb) => {
        // Generate a unique filename using current timestamp and random bytes
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `${uniqueSuffix}${extension}`);
    }
});

const upload = multer({ 
    storage, 
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, and PNG files are allowed'));
        }
    }
});

// Route to add a new question
router.post('/add', upload.single('image'), async (req, res) => {
    const { question, options, answer } = req.body;

    if (!question || !options || !answer) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const formattedOptions = options.split(',').join('\n');
        let finalQuestion = question;

        // Check if an image was uploaded
        if (req.file) {
            const imagePath = `/uploads/${req.file.filename}`;
            // Append the image path to the question field
            finalQuestion = imagePath;
        }

        // Create a new question document
        const newQuestion = new Question({
            question: finalQuestion,
            options: formattedOptions,
            answer,
        });

        // Save the question to the database
        await newQuestion.save();

        return res.status(201).json({ message: 'Question added successfully'});
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error saving question', error: err.message });
    }
});

// 2. Edit an existing question
router.put('/edit/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;  // Get the question ID from the URL
    const { question, options, answer } = req.body;

    if (!question || !options || !answer) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const formattedOptions = options.split(',').join('\n');
        let finalQuestion = question;

        // Check if an image was uploaded
        if (req.file) {
            const imagePath = `/uploads/${req.file.filename}`;
            // Append the image path to the question field if an image was uploaded
            finalQuestion = imagePath;
        }

        // Find the question by ID and update it
        const updatedQuestion = await Question.findByIdAndUpdate(id, 
            { 
                question: finalQuestion, 
                options: formattedOptions, 
                answer 
            }, 
            { new: true } // return the updated document
        );

        if (!updatedQuestion) {
            return res.status(404).json({ message: 'Question not found' });
        }

        return res.status(200).json({ message: 'Question updated successfully'});
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

// 4. Fetch all questions
router.get('/', async (req, res) => {
    try {
        // Fetch all questions from the database
        const questions = await fetchQuizQuestions();
        return res.status(200).json(questions); // Return questions as JSON
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching questions', error: err.message });
    }
});


module.exports = router;
