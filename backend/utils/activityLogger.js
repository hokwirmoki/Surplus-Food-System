const db = require("../src/config/db");

async function logActivity({ userId = null, activityType, source = null, metadata = null }) {
  try {
    await db.query(
      `INSERT INTO user_activity (user_id, activity_type, source, metadata)
       VALUES ($1, $2, $3, $4)`,
      [userId, activityType, source, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error("ACTIVITY LOG ERROR:", err.message);
  }
}

module.exports = logActivity;