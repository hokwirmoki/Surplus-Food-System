const express = require("express");
const router = express.Router();

const recipientController = require("../controllers/recipientController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/available", authMiddleware, recipientController.getAvailableFood);
router.post("/claim", authMiddleware, recipientController.claimFood);
router.post("/confirm-pickup", authMiddleware, recipientController.confirmPickup);
router.get("/claims", authMiddleware, recipientController.getMyClaims);

module.exports = router;