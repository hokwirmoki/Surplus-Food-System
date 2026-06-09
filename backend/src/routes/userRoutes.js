const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

router.put("/update", authMiddleware, userController.updateUser);
router.get("/me", authMiddleware, userController.getCurrentUser);
router.post("/donor/verify", authMiddleware, userController.applyForVerification);

module.exports = router;