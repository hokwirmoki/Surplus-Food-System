const db = require("../config/db");

exports.getDonorAnalytics = async (req, res) => {
  try {
    const donor_id = req.user.id;

    // ---------------- TOTAL DONATED ----------------
    const totalDonated = await db.query(
      `SELECT COUNT(*) FROM food_items WHERE donor_id = $1`,
      [donor_id]
    );

    // ---------------- TOTAL CLAIMED ----------------
    const totalClaimed = await db.query(
      `SELECT COUNT(*) FROM food_items 
       WHERE donor_id = $1 AND status = 'claimed'`,
      [donor_id]
    );

    // ---------------- PEOPLE HELPED ----------------
    const peopleHelped = await db.query(
      `SELECT COUNT(DISTINCT c.recipient_id)
       FROM claims c
       JOIN food_items f ON f.id = c.food_id
       WHERE f.donor_id = $1`,
      [donor_id]
    );

    // ---------------- HISTORY ----------------
    const history = await db.query(
      `SELECT 
          f.food_type,
          f.quantity,
          f.status,
          f.created_at,
          c.created_at as claimed_at
       FROM food_items f
       LEFT JOIN claims c ON f.id = c.food_id
       WHERE f.donor_id = $1
       ORDER BY f.created_at DESC`,
      [donor_id]
    );

    // ---------------- PREDICTIVE ANALYTICS ----------------
    const claimTimes = await db.query(
      `SELECT EXTRACT(hour from c.created_at) as hour
       FROM claims c
       JOIN food_items f ON f.id = c.food_id
       WHERE f.donor_id = $1`,
      [donor_id]
    );

    // Count claims per hour
    const hourCounts = {};
    claimTimes.rows.forEach(row => {
      const hour = row.hour;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find top hours
    const topHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), claims: count }));

    res.json({
      // 🔥 FIX: convert COUNT strings → numbers
      totalDonated: Number(totalDonated.rows[0].count),
      totalClaimed: Number(totalClaimed.rows[0].count),
      peopleHelped: Number(peopleHelped.rows[0].count),
      history: history.rows,
      predictive: {
        suggestedPostingHours: topHours
      }
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};