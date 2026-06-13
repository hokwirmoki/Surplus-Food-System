const db = require("../src/config/db");

const queue = [];
const MAX_BATCH_SIZE = Number(process.env.ACTIVITY_LOG_BATCH_SIZE || 100);
const FLUSH_INTERVAL_MS = Number(process.env.ACTIVITY_LOG_FLUSH_INTERVAL_MS || 1000);
const MAX_QUEUE_SIZE = Number(process.env.ACTIVITY_LOG_MAX_QUEUE || 5000);
let flushing = false;

function normalizeActivity({ userId = null, activityType, source = null, metadata = null }) {
  if (!activityType) {
    return null;
  }

  return {
    userId,
    activityType,
    source,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
}

async function flushActivityLogs() {
  if (flushing || queue.length === 0) {
    return;
  }

  flushing = true;
  const batch = queue.splice(0, MAX_BATCH_SIZE);

  try {
    const values = [];
    const placeholders = batch.map((item, index) => {
      const offset = index * 4;
      values.push(item.userId, item.activityType, item.source, item.metadata);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    });

    await db.query(
      `INSERT INTO user_activity (user_id, activity_type, source, metadata)
       VALUES ${placeholders.join(", ")}`,
      values
    );
  } catch (err) {
    console.error("ACTIVITY LOG ERROR:", err.message);
  } finally {
    flushing = false;

    if (queue.length > 0) {
      setImmediate(flushActivityLogs);
    }
  }
}

function logActivity(activity) {
  const normalized = normalizeActivity(activity || {});
  if (!normalized) {
    return false;
  }

  if (queue.length >= MAX_QUEUE_SIZE) {
    console.error("ACTIVITY LOG ERROR: queue full");
    return false;
  }

  queue.push(normalized);

  if (queue.length >= MAX_BATCH_SIZE) {
    setImmediate(flushActivityLogs);
  }

  return true;
}

const interval = setInterval(flushActivityLogs, FLUSH_INTERVAL_MS);
if (interval.unref) {
  interval.unref();
}

module.exports = logActivity;
