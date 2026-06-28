const db = require("../config/db");
const User = require("../models/User");
const expireVerificationBadges = require("../../utils/verificationExpiry");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");

// View Impact
exports.getImpactMetrics = async (req, res) => {
    try {
        await updateExpiredFood();
        await expireVerificationBadges();

        const legacyKgPerClaimUnit = 0.5;
        const foodWasteCo2ePerKg = 2.5;

        // Total users
        const totalUsersResult = await db.query("SELECT COUNT(*) as count FROM users");
        const totalUsers = parseInt(totalUsersResult.rows[0].count);

        // Active food listings
        const activeFoodResult = await db.query("SELECT COUNT(*) as count FROM food_items WHERE status = 'available'");
        const activeFoodListings = parseInt(activeFoodResult.rows[0].count);

        const impactResult = await db.query(
            `SELECT
                COALESCE(SUM(c.quantity), 0) AS claimed_units,
                COALESCE(SUM(
                    c.quantity * COALESCE(
                        f.estimated_unit_weight_kg,
                        f.estimated_weight_kg / NULLIF(f.quantity_amount, 0),
                        $1
                    )
                ), 0) AS claimed_kg,
                COALESCE(SUM(
                    c.quantity * COALESCE(
                        f.estimated_unit_weight_kg,
                        f.estimated_weight_kg / NULLIF(f.quantity_amount, 0),
                        $1
                    ) * $2
                ), 0) AS co2e_saved
             FROM claims c
             JOIN food_items f ON f.id = c.food_id
             WHERE c.status IN ('claimed', 'picked_up')`,
            [legacyKgPerClaimUnit, foodWasteCo2ePerKg]
        );

        const totalFoodClaimedUnits = Number(impactResult.rows[0].claimed_units || 0);
        const totalFoodDonatedKg = Number(impactResult.rows[0].claimed_kg || 0);

        // Total people helped
        const peopleHelpedResult = await db.query(
            "SELECT COUNT(DISTINCT recipient_id) as count FROM claims WHERE status IN ('claimed', 'picked_up')"
        );
        const totalPeopleHelped = parseInt(peopleHelpedResult.rows[0].count);

        // Verified donors
        const verifiedDonorsResult = await db.query(`
            SELECT COUNT(*) as count
            FROM users
            WHERE role = 'donor'
              AND verification_status = 'verified'
              AND verification_expires_at > NOW()
        `);
        const verifiedDonors = parseInt(verifiedDonorsResult.rows[0].count);

        // CO₂ saved
        const co2Saved = Number(impactResult.rows[0].co2e_saved || 0);

        res.json({
            totalUsers,
            activeFoodListings,
            totalFoodDonatedKg: Number(totalFoodDonatedKg.toFixed(2)),
            totalFoodClaimedUnits,
            totalFoodClaimedPlates: totalFoodClaimedUnits,
            totalPeopleHelped,
            totalPeopleHealed: totalPeopleHelped,
            verifiedDonors,
            co2Saved: Number(co2Saved.toFixed(2))
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

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid verification status" });
        }

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

        // Discounted food purchases
        const discountedFoodSalesResult = await db.query("SELECT SUM(amount) as total FROM transactions WHERE type = 'purchase'");
        const discountedFoodSales = parseFloat(discountedFoodSalesResult.rows[0].total || 0);

        // Commission is 5% of successfully claimed discounted food only.
        const commissions = Number((discountedFoodSales * 0.05).toFixed(2));

        res.json({
            reservationFees,
            verificationFees,
            discountedFoodSales,
            commissions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
