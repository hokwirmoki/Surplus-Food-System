const db = require("../config/db");
const User = require("../models/User");

// View Impact
exports.getImpactMetrics = async (req, res) => {
    try {
        // Total users
        const totalUsersResult = await db.query("SELECT COUNT(*) as count FROM users");
        const totalUsers = parseInt(totalUsersResult.rows[0].count);

        // Active food listings
        const activeFoodResult = await db.query("SELECT COUNT(*) as count FROM food_items WHERE status = 'available'");
        const activeFoodListings = parseInt(activeFoodResult.rows[0].count);

        // Total food donated (sum of quantities) - strip non-numeric suffixes like 'plates'
        const totalDonatedResult = await db.query(
          "SELECT COALESCE(SUM(CAST(NULLIF(regexp_replace(quantity, '[^0-9\\.]', '', 'g'), '') AS numeric)), 0) AS total FROM food_items"
        );
        const totalFoodDonated = parseFloat(totalDonatedResult.rows[0].total || 0);

        // Total food claimed
        const totalClaimedResult = await db.query(
          "SELECT COALESCE(SUM(CAST(NULLIF(regexp_replace(quantity, '[^0-9\\.]', '', 'g'), '') AS numeric)), 0) AS total FROM food_items WHERE status = 'claimed'"
        );
        const totalFoodClaimed = parseFloat(totalClaimedResult.rows[0].total || 0);

        // Meals saved (assume 1 meal per kg or something, but use quantity as meals)
        const mealsSaved = totalFoodClaimed;

        // Total people healed (unique recipients who claimed)
        const peopleHealedResult = await db.query("SELECT COUNT(DISTINCT recipient_id) as count FROM claims");
        const totalPeopleHealed = parseInt(peopleHealedResult.rows[0].count);

        // Verified donors
        const verifiedDonorsResult = await db.query("SELECT COUNT(*) as count FROM users WHERE role = 'donor' AND is_verified = true");
        const verifiedDonors = parseInt(verifiedDonorsResult.rows[0].count);

        // CO₂ saved
        const co2Saved = totalFoodClaimed * 2.5;

        res.json({
            totalUsers,
            activeFoodListings,
            mealsSaved,
            totalFoodDonated,
            totalFoodClaimed,
            totalPeopleHealed,
            verifiedDonors,
            co2Saved
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Verify Users
exports.getUsersForVerification = async (req, res) => {
    try {
        const users = await User.getAllUsers();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.verifyUser = async (req, res) => {
    try {
        const { userId, status } = req.body;
        const currentUserRes = await db.query(
            `SELECT documents FROM users WHERE id = $1`,
            [userId]
        );

        const documents = currentUserRes.rows[0]?.documents || null;
        const user = await User.updateVerificationStatus(userId, status, documents);
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// View Financials
exports.getFinancials = async (req, res) => {
    try {
        // Reservation fees
        const reservationFeesResult = await db.query("SELECT SUM(amount) as total FROM transactions WHERE type = 'reservation'");
        const reservationFees = parseFloat(reservationFeesResult.rows[0].total || 0);

        // Verification fees
        const verificationFeesResult = await db.query("SELECT SUM(amount) as total FROM transactions WHERE type = 'verification'");
        const verificationFees = parseFloat(verificationFeesResult.rows[0].total || 0);

        // Commissions
        const commissionsResult = await db.query("SELECT SUM(amount) as total FROM transactions WHERE type = 'commission'");
        const commissions = parseFloat(commissionsResult.rows[0].total || 0);

        res.json({
            reservationFees,
            verificationFees,
            commissions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};