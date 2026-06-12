const db = require("../src/config/db");

async function expireVerificationBadges() {
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
