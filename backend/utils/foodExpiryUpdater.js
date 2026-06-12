const db = require("../src/config/db");

let lastRunAt = 0;
const MIN_INTERVAL_MS = 60 * 1000;

// auto mark expired food
const updateExpiredFood = async ({ force = false } = {}) => {
  const now = Date.now();

  if (!force && now - lastRunAt < MIN_INTERVAL_MS) {
    return;
  }

  lastRunAt = now;

  try {
    await db.query(`
      UPDATE food_items
      SET status = 'expired'
      WHERE expiry_time IS NOT NULL
      AND expiry_time < NOW()
      AND status = 'available'
    `);
  } catch (err) {
    console.error("Expiry update error:", err.message);
  }
};

module.exports = updateExpiredFood;
