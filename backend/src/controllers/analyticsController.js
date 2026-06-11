const db = require("../config/db");

function toTimeRange(hour) {
  const startHour = ((hour % 24) + 24) % 24;
  const endHour = (startHour + 3) % 24;
  const format = (value) => String(value).padStart(2, "0") + ":00";
  return `${format(startHour)} – ${format(endHour)}`;
}

function normalize(value, maxValue) {
  if (!maxValue) return 0;
  return value / maxValue;
}

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
    const predictiveRows = await db.query(
      `WITH claim_stats AS (
         SELECT
           EXTRACT(HOUR FROM f.created_at)::int AS posting_hour,
           COUNT(c.id) AS claimed_count,
           COUNT(f.id) AS posted_count,
           AVG(EXTRACT(EPOCH FROM (c.created_at - f.created_at)) / 60.0) AS avg_claim_minutes
         FROM food_items f
         LEFT JOIN claims c ON c.food_id = f.id
         WHERE f.donor_id = $1
         GROUP BY EXTRACT(HOUR FROM f.created_at)
       ), activity_stats AS (
         SELECT
           EXTRACT(HOUR FROM created_at)::int AS activity_hour,
           COUNT(*) AS activity_events,
           COUNT(DISTINCT user_id) AS active_users
         FROM user_activity
         GROUP BY EXTRACT(HOUR FROM created_at)
       )
       SELECT
         hours.hour,
         COALESCE(cs.claimed_count, 0) AS claimed_count,
         COALESCE(cs.posted_count, 0) AS posted_count,
         COALESCE(cs.avg_claim_minutes, 0) AS avg_claim_minutes,
         COALESCE(as2.activity_events, 0) AS activity_events,
         COALESCE(as2.active_users, 0) AS active_users
       FROM generate_series(0, 23) AS hours(hour)
       LEFT JOIN claim_stats cs ON cs.posting_hour = hours.hour
       LEFT JOIN activity_stats as2 ON as2.activity_hour = hours.hour
       ORDER BY hours.hour`,
      [donor_id]
    );

    const maxClaimed = Math.max(...predictiveRows.rows.map((row) => Number(row.claimed_count) || 0), 0);
    const maxPosted = Math.max(...predictiveRows.rows.map((row) => Number(row.posted_count) || 0), 0);
    const maxActivity = Math.max(...predictiveRows.rows.map((row) => Number(row.activity_events) || 0), 0);
    const maxActiveUsers = Math.max(...predictiveRows.rows.map((row) => Number(row.active_users) || 0), 0);

    const hourlyScores = predictiveRows.rows.map((row) => {
      const claimedCount = Number(row.claimed_count) || 0;
      const postedCount = Number(row.posted_count) || 0;
      const activityEvents = Number(row.activity_events) || 0;
      const activeUsers = Number(row.active_users) || 0;
      const avgClaimMinutes = Number(row.avg_claim_minutes) || 0;

      const claimRate = postedCount > 0 ? claimedCount / postedCount : 0;
      const speedScore = avgClaimMinutes > 0 ? 1 / (1 + avgClaimMinutes / 60) : 0;
      const combinedActivity = (normalize(activityEvents, maxActivity) + normalize(activeUsers, maxActiveUsers)) / 2;
      const demandScore = (normalize(claimedCount, maxClaimed) + normalize(postedCount, maxPosted)) / 2;

      const score = (claimRate * 0.45) + (speedScore * 0.25) + (combinedActivity * 0.20) + (demandScore * 0.10);

      return {
        hour: Number(row.hour),
        score,
        claimedCount,
        postedCount,
        activityEvents,
        activeUsers,
        avgClaimMinutes
      };
    });

    const windowScores = hourlyScores.map((row, index, rows) => {
      const next1 = rows[(index + 1) % 24];
      const next2 = rows[(index + 2) % 24];
      const totalScore = row.score + next1.score + next2.score;

      return {
        startHour: row.hour,
        score: totalScore
      };
    });

    const hasPredictiveData = predictiveRows.rows.some((row) => {
      return (
        Number(row.claimed_count) > 0 ||
        Number(row.posted_count) > 0 ||
        Number(row.activity_events) > 0 ||
        Number(row.active_users) > 0
      );
    });

    const bestWindow = windowScores.sort((a, b) => b.score - a.score)[0];
    const bestPostingWindow = hasPredictiveData
      ? toTimeRange(bestWindow?.startHour ?? 11)
      : "11:00 – 14:00";

    res.json({
      // 🔥 FIX: convert COUNT strings → numbers
      totalDonated: Number(totalDonated.rows[0].count),
      totalClaimed: Number(totalClaimed.rows[0].count),
      peopleHelped: Number(peopleHelped.rows[0].count),
      history: history.rows,
      predictive: {
        bestPostingWindow
      }
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};