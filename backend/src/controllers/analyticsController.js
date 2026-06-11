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
      `WITH claimed_by_food AS (
         SELECT food_id, COALESCE(SUM(quantity), 0) AS claimed_qty
         FROM claims
         GROUP BY food_id
       )
       SELECT COALESCE(SUM((
         COALESCE(CAST(NULLIF(regexp_replace(f.quantity, '[^0-9\\.]', '', 'g'), '') AS numeric), 0)
         + COALESCE(c.claimed_qty, 0)
       )), 0) AS total
       FROM food_items f
       LEFT JOIN claimed_by_food c ON c.food_id = f.id
       WHERE f.donor_id = $1`,
      [donor_id]
    );

    // ---------------- TOTAL CLAIMED ----------------
    const totalClaimed = await db.query(
      `SELECT COALESCE(SUM(c.quantity), 0) AS total
       FROM claims c
       JOIN food_items f ON f.id = c.food_id
       WHERE f.donor_id = $1`,
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
      `WITH claims_by_food AS (
         SELECT
           food_id,
           COALESCE(SUM(quantity), 0) AS claimed_qty,
           MAX(created_at) AS claimed_at
         FROM claims
         GROUP BY food_id
       )
       SELECT
         f.id,
         f.food_type,
         (
           COALESCE(CAST(NULLIF(regexp_replace(f.quantity, '[^0-9\\.]', '', 'g'), '') AS numeric), 0)
           + COALESCE(cb.claimed_qty, 0)
         ) AS quantity,
         f.status,
         f.created_at,
         cb.claimed_at
       FROM food_items f
       LEFT JOIN claims_by_food cb ON cb.food_id = f.id
       WHERE f.donor_id = $1
       ORDER BY f.created_at DESC`,
      [donor_id]
    );

    res.json({
      totalDonated: Number(totalDonated.rows[0].total),
      totalClaimed: Number(totalClaimed.rows[0].total),
      peopleHelped: Number(peopleHelped.rows[0].count),
      history: history.rows,
      predictive: {
        bestPostingWindow: "11:00 – 14:00"
      }
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};