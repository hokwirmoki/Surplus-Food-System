const db = require("../config/db");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");
const { sendWhatsApp } = require("../../utils/notificationService");
const logActivity = require("../../utils/activityLogger");


// ============================
// GET AVAILABLE FOOD (FIXED)
// ============================
exports.getAvailableFood = async (req, res) => {
  try {
    // auto-update expired food first
    await updateExpiredFood();

    if (req.user?.id) {
      logActivity({
        userId: req.user.id,
        activityType: "view_available_food",
        source: "recipient_food_list"
      });
    }

    const result = await db.query(`
      SELECT f.*, u.name as donor_name, u.verification_status = 'verified' as donor_verified
      FROM food_items f
      JOIN users u ON f.donor_id = u.id
      WHERE f.status = 'available'
      ORDER BY expiry_time ASC NULLS LAST
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("GET AVAILABLE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch available food" });
  }
};

// Haversine distance function
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function parseQuantity(value) {
  const parsed = Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ============================
// CLAIM FOOD (UPDATED WITH DONOR NOTIFICATION)
// ============================
exports.claimFood = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    client = await db.connect();
    const recipient_id = req.user.id;
    const { food_id, quantity, paymentProvider, paymentNumber } = req.body;

    if (!food_id) {
      return res.status(400).json({ message: "food_id is required" });
    }

    if (!paymentProvider || !paymentNumber) {
      return res.status(400).json({ message: "Payment provider and number are required" });
    }

    const requestedQuantity = Number(quantity) || 1;
    if (requestedQuantity <= 0) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    // ============================
    // GET FOOD + DONOR INFO
    // ============================
    const foodResult = await client.query(
      `SELECT f.*, u.phone, u.notification_mode, u.name as donor_name
       FROM food_items f
       JOIN users u ON f.donor_id = u.id
       WHERE f.id = $1
       FOR UPDATE OF f`,
      [food_id]
    );

    if (foodResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ message: "Food not found" });
    }

    const food = foodResult.rows[0];

    if (food.status !== "available") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ message: "Food already claimed or expired" });
    }

    const availableQuantity = parseQuantity(food.quantity);
    if (requestedQuantity > availableQuantity) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ message: `Only ${availableQuantity} unit(s) available` });
    }

    const remainingQuantity = availableQuantity - requestedQuantity;
    const newStatus = remainingQuantity === 0 ? 'claimed' : 'available';
    const isDiscounted = Boolean(food.is_discounted);
    const paymentAmount = isDiscounted ? Number(food.discount_price || 0) * requestedQuantity : 1000;
    const transactionType = isDiscounted ? 'purchase' : 'reservation';

    // ============================
    // UPDATE FOOD STATUS / QUANTITY
    // ============================
    await client.query(
      `UPDATE food_items
       SET quantity = $1::varchar,
           status = $2::varchar,
           claimed_by = CASE WHEN $2::varchar = 'claimed' THEN $3 ELSE claimed_by END
       WHERE id = $4`,
      [remainingQuantity, newStatus, recipient_id, food_id]
    );

    // ============================
    // SAVE CLAIM RECORD
    // ============================
    await client.query(
      `INSERT INTO claims
       (food_id, recipient_id, quantity, status, reservation_fee_paid)
       VALUES ($1, $2, $3, 'claimed', true)`,
      [food_id, recipient_id, requestedQuantity]
    );

    // ============================
    // CHARGE FEE OR PURCHASE AMOUNT
    // ============================
    await client.query(
      `INSERT INTO transactions (type, amount, user_id, food_id)
       VALUES ($1, $2, $3, $4)`,
      [transactionType, paymentAmount, recipient_id, food_id]
    );

    if (isDiscounted) {
      const commission = Number((paymentAmount * 0.05).toFixed(2));
      await client.query(
        `INSERT INTO transactions (type, amount, user_id, food_id)
         VALUES ('commission', $1, $2, $3)`,
        [commission, recipient_id, food_id]
      );
    }

    // ============================
    // GET RECIPIENT INFO
    // ============================
    const recipientRes = await client.query(
      `SELECT name FROM users WHERE id = $1`,
      [recipient_id]
    );

    const recipient = recipientRes.rows[0];

    await client.query("COMMIT");
    transactionStarted = false;

    logActivity({
      userId: recipient_id,
      activityType: "claim_food",
      source: "recipient_claim",
      metadata: { food_id, quantity: requestedQuantity }
    });

    // ============================
    // 📲 NOTIFY DONOR (WHATSAPP ONLY)
    // ============================
    const message = `
🍱 Your food has been CLAIMED!

Food: ${food.food_type}
Quantity: ${food.quantity}
Location: ${food.location}

👤 Claimed by: ${recipient?.name || "A recipient"}

⏰ Time: ${new Date().toLocaleString()}
`;

    if (food.phone && food.notification_mode === "whatsapp") {
      sendWhatsApp(food.phone, message);
    }

    res.json({ message: "Food claimed successfully. Please confirm pickup upon collection." });

  } catch (err) {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("CLAIM ROLLBACK ERROR:", rollbackErr.message);
      }
    }
    console.error("CLAIM ERROR:", err);
    res.status(500).json({
      message: "Claim failed",
      error: process.env.NODE_ENV === "production" ? undefined : err.message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================
// CONFIRM PICKUP
// ============================
exports.confirmPickup = async (req, res) => {
  try {
    const recipient_id = req.user.id;
    const { food_id } = req.body;

    // Update claim status
    await db.query(
      `UPDATE claims SET status = 'picked_up', reservation_fee_paid = true WHERE food_id = $1 AND recipient_id = $2`,
      [food_id, recipient_id]
    );

    // Update food pickup status
    await db.query(
      `UPDATE food_items SET pickup_status = 'picked_up' WHERE id = $1`,
      [food_id]
    );

    res.json({ message: "Pickup confirmed successfully" });

  } catch (err) {
    console.error("CONFIRM PICKUP ERROR:", err);
    res.status(500).json({ error: "Confirm pickup failed" });
  }
};

// ============================
// MY CLAIMS (UPDATED)
// ============================
exports.getMyClaims = async (req, res) => {
  try {
    const recipient_id = req.user.id;

    const result = await db.query(
      `SELECT 
          f.food_type,
          c.quantity,
          f.location,
          c.status,
          c.created_at as claimed_at,
          f.id as food_id
       FROM claims c
       JOIN food_items f ON f.id = c.food_id
       WHERE c.recipient_id = $1
       ORDER BY c.created_at DESC`,
      [recipient_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("MY CLAIMS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
};
