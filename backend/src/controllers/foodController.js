const db = require("../config/db");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");
const { sendWhatsApp } = require("../../utils/notificationService");

// ============================
// POST FOOD
// ============================
exports.postFood = async (req, res) => {
  try {
    const donor_id = req.user.id;

    const { food_type, quantity, expiry_time, is_discounted, price } = req.body;

    // Get location from user
    const { location, latitude, longitude } = req.body;

    if (!location || location.trim() === "") {
      return res.status(400).json({
        message: "Food location is required. Please enter a location or pick it on the map."
      });
    }

    if (is_discounted && !price) {
      return res.status(400).json({
        message: "Discounted food must include a price."
      });
    }

    const food = await db.query(
      `INSERT INTO food_items
      (donor_id, food_type, quantity, location, expiry_time, status, is_discounted, discount_price)
      VALUES ($1, $2, $3, $4, $5, 'available', $6, $7)
      RETURNING *`,
      [
        donor_id,
        food_type,
        quantity,
        location,
        expiry_time,
        is_discounted || false,
        price || null
      ]
    );

    // If discounted, calculate commission 5%
    if (is_discounted && price) {
      const commission = price * 0.05;
      await db.query(
        `INSERT INTO transactions (type, amount, user_id, food_id)
         VALUES ('commission', $1, $2, $3)`,
        [commission, donor_id, food.rows[0].id]
      );
    }

    // ==================================================
    // 📲 WHATSAPP NOTIFICATION ONLY (NO EMAIL SYSTEM)
    // ==================================================
    const recipients = await db.query(
      `SELECT phone, notification_mode
       FROM users
       WHERE role = 'recipient'`
    );

    // Use the saved food location for notifications
    const savedFood = food.rows[0];
    const mapLink = savedFood.latitude && savedFood.longitude
      ? `https://www.google.com/maps?q=${savedFood.latitude},${savedFood.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedFood.location || "")}`;

    const message = `
🍱 New Food Available!
Food: ${savedFood.food_type}
Quantity: ${savedFood.quantity}
Location: ${savedFood.location || "GPS Location"}

📍 Open in Google Maps:
${mapLink}
`;

    recipients.rows.forEach((r) => {
      if (!r.phone) return;

      if (r.notification_mode === "whatsapp") {
        sendWhatsApp(r.phone, message);
      }
    });

    res.status(201).json(savedFood);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ============================
// GET DONOR FOOD
// ============================
exports.getPostedFood = async (req, res) => {
  try {
    const donor_id = req.user.id;

    await updateExpiredFood();

    const foods = await db.query(
      `SELECT *
       FROM food_items
       WHERE donor_id = $1
       AND status = 'available'
       ORDER BY created_at DESC`,
      [donor_id]
    );

    res.json(foods.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};