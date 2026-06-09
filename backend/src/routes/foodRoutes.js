const express = require('express');
const router = express.Router();

const foodController = require('../controllers/foodController');
const authMiddleware = require("../middleware/authMiddleware");

// post food
router.post('/post', authMiddleware, foodController.postFood);

// get posted food
router.get('/posted', authMiddleware, foodController.getPostedFood);

module.exports = router;