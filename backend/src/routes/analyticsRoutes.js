const express = require("express");
const router = express.Router();

const analyticsController = require("../controllers/analyticsController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/donor", authMiddleware, analyticsController.getDonorAnalytics);

module.exports = router;