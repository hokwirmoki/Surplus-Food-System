const db = require("../config/db");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");
const { sendWhatsApp } = require("../../utils/notificationService");
const logActivity = require("../../utils/activityLogger");
const expireVerificationBadges = require("../../utils/verificationExpiry");
const {
  createSandboxPayment,
  consumeSuccessfulPayment,
} = require("../../utils/paymentService");

const NEARBY_RADIUS_KM = Number(process.env.NEARBY_RADIUS_KM || 10);

exports.getAvailableFood = async (req, res) => {
  try {
    await updateExpiredFood();

    setImmediate(() => {
      expireVerificationBadges().catch((err) => {
        console.error("VERIFICATION EXPIRY ERROR:", err.message);
      });
    });

    if (req.user?.id) {
      logActivity({
        userId: req.user.id,
        activityType: "view_available_food",
        source: "recipient_food_list"
      });
    }

    const result = await db.query(
      `WITH current_recipient AS (
         SELECT latitude, longitude
         FROM users
         WHERE id = $1
       ),
       available_food AS (
         SELECT
           f.*,
           u.name as donor_name,
           (
             u.verification_status = 'verified'
             AND u.verification_expires_at IS NOT NULL
             AND u.verification_expires_at > NOW()
           ) as donor_verified,
           CASE
             WHEN cr.latitude IS NOT NULL
              AND cr.longitude IS NOT NULL
              AND f.latitude IS NOT NULL
              AND f.longitude IS NOT NULL THEN
               6371 * acos(
                 LEAST(1, GREATEST(-1,
                   cos(radians(cr.latitude)) *
                   cos(radians(f.latitude)) *
                   cos(radians(f.longitude) - radians(cr.longitude)) +
                   sin(radians(cr.latitude)) *
                   sin(radians(f.latitude))
                 ))
               )
             ELSE NULL
           END AS distance_km
         FROM food_items f
         JOIN users u ON f.donor_id = u.id
         CROSS JOIN current_recipient cr
         WHERE f.status = 'available'
       ),
       ranked_food AS (
         SELECT
           *,
           EXISTS (
             SELECT 1
             FROM available_food
             WHERE distance_km <= $2
           ) AS has_nearby_food
         FROM available_food
       )
       SELECT *
       FROM ranked_food
       ORDER BY
         CASE
           WHEN has_nearby_food AND distance_km <= $2 THEN 0
           WHEN has_nearby_food THEN 1
           ELSE 0
         END,
         distance_km ASC NULLS LAST,
         expiry_time ASC NULLS LAST`,
      [req.user.id, NEARBY_RADIUS_KM]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("GET AVAILABLE ERROR:", err);
    res.status(500).json({ error: "Failed to fetch available food" });
  }
};

function parseQuantity(value) {
  const parsed = Number.parseInt(String(value).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

exports.claimFood = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    client = await db.connect();
    const recipient_id = req.user.id;
    const { food_id, quantity, paymentProvider, paymentNumber, paymentReference } = req.body;

    if (!food_id) {
      return res.status(400).json({ message: "food_id is required" });
    }

    if (!paymentReference && (!paymentProvider || !paymentNumber)) {
      return res.status(400).json({ message: "Payment provider and number are required" });
    }

    const requestedQuantity = Number(quantity) || 1;
    if (requestedQuantity <= 0) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    await client.query("BEGIN");
    transactionStarted = true;

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
    const newStatus = remainingQuantity === 0 ? "claimed" : "available";
    const isDiscounted = Boolean(food.is_discounted);
    const paymentAmount = isDiscounted ? Number(food.discount_price || 0) * requestedQuantity : 1000;
    const transactionType = isDiscounted ? "purchase" : "reservation";
    const payment = paymentReference
      ? await consumeSuccessfulPayment(client, {
        reference: paymentReference,
        userId: recipient_id,
        purpose: "claim",
        amount: paymentAmount,
        foodId: food_id,
      })
      : await createSandboxPayment(client, {
        userId: recipient_id,
        provider: paymentProvider,
        phone: paymentNumber,
        amount: paymentAmount,
        purpose: "claim",
        foodId: food_id,
        metadata: { quantity: requestedQuantity },
        consume: true,
      });

    await client.query(
      `UPDATE food_items
       SET quantity = $1::varchar,
           status = $2::varchar,
           claimed_by = CASE WHEN $2::varchar = 'claimed' THEN $3 ELSE claimed_by END
       WHERE id = $4`,
      [remainingQuantity, newStatus, recipient_id, food_id]
    );

    await client.query(
      `INSERT INTO claims
       (food_id, recipient_id, quantity, status, reservation_fee_paid)
       VALUES ($1, $2, $3, 'claimed', true)`,
      [food_id, recipient_id, requestedQuantity]
    );

    await client.query(
      `INSERT INTO transactions
       (type, amount, user_id, food_id, payment_id, payment_provider, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [transactionType, paymentAmount, recipient_id, food_id, payment.id, payment.provider, payment.reference]
    );

    if (isDiscounted) {
      const commission = Number((paymentAmount * 0.05).toFixed(2));
      await client.query(
        `INSERT INTO transactions
         (type, amount, user_id, food_id, payment_id, payment_provider, payment_reference)
         VALUES ('commission', $1, $2, $3, $4, $5, $6)`,
        [commission, recipient_id, food_id, payment.id, payment.provider, payment.reference]
      );
    }

    const recipientRes = await client.query(
      `SELECT name FROM users WHERE id = $1`,
      [recipient_id]
    );

    const recipient = recipientRes.rows[0];

    await client.query("COMMIT");
    transactionStarted = false;

    res.json({
      message: "Sandbox payment successful. Food claimed successfully. Please confirm pickup upon collection.",
      payment: {
        reference: payment.reference,
        provider: payment.provider,
        amount: Number(payment.amount),
        status: payment.status,
      },
    });

    logActivity({
      userId: recipient_id,
      activityType: "claim_food",
      source: "recipient_claim",
      metadata: { food_id, quantity: requestedQuantity, payment_reference: payment.reference }
    });

    setImmediate(() => {
      if (food.phone && food.notification_mode === "whatsapp") {
        const message = [
          "Your food has been claimed.",
          `Food: ${food.food_type}`,
          `Quantity: ${requestedQuantity}`,
          `Location: ${food.location}`,
          `Claimed by: ${recipient?.name || "A recipient"}`,
          `Time: ${new Date().toLocaleString()}`
        ].join("\n");

        sendWhatsApp(food.phone, message).then((result) => {
          if (!result.ok) {
            console.error("CLAIM NOTIFICATION SEND ERROR:", result.error);
          }
        });
      }
    });

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

exports.confirmPickup = async (req, res) => {
  try {
    const recipient_id = req.user.id;
    const { food_id } = req.body;

    await db.query(
      `UPDATE claims SET status = 'picked_up', reservation_fee_paid = true WHERE food_id = $1 AND recipient_id = $2`,
      [food_id, recipient_id]
    );

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
