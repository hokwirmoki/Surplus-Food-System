const db = require("../src/config/db");

let lastRunAt = 0;
const MIN_INTERVAL_MS = 5 * 60 * 1000;

async function expireVerificationBadges({ force = false } = {}) {
  const now = Date.now();

  if (!force && now - lastRunAt < MIN_INTERVAL_MS) {
    return;
  }

  lastRunAt = now;

  await db.query(`
    UPDATE users
    SET verification_status = 'expired'
    WHERE role = 'donor'
      AND verification_status = 'verified'
      AND verification_expires_at IS NOT NULL
      AND verification_expires_at <= NOW()
  `);
}

module.exports = expireVerificationBadges;
