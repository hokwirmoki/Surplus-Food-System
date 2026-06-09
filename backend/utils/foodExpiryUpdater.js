const db = require("../src/config/db");

// auto mark expired food
const updateExpiredFood = async () => {
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