const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");

// All admin routes require admin role
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
});

router.get("/impact", adminController.getImpactMetrics);
router.get("/users", adminController.getUsersForVerification);
router.put("/verify", adminController.verifyUser);
router.get("/financials", adminController.getFinancials);

module.exports = router;