const db = require("../config/db");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");
const { sendWhatsApp } = require("../../utils/notificationService");
const logActivity = require("../../utils/activityLogger");

const NEARBY_RADIUS_KM = Number(process.env.NEARBY_RADIUS_KM || 10);

exports.postFood = async (req, res) => {
  try {
    const donor_id = req.user.id;
    const { food_type, quantity, expiry_time, is_discounted, price } = req.body;
    const { location, latitude, longitude } = req.body;

    if (!location || location.trim() === "") {
      return res.status(400).json({
        message: "Food location is required. Please enter a location or pick it on the map."
      });
    }

    const numericQuantity = Number.parseInt(String(quantity).replace(/[^0-9]/g, ""), 10);

    if (!food_type || !String(food_type).trim()) {
      return res.status(400).json({ message: "Food type is required." });
    }

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive number." });
    }

    if (is_discounted && !price) {
      return res.status(400).json({
        message: "Discounted food must include a price."
      });
    }

    const food = await db.query(
      `INSERT INTO food_items
      (donor_id, food_type, quantity, location, expiry_time, status, is_discounted, discount_price, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, 'available', $6, $7, $8, $9)
      RETURNING *`,
      [
        donor_id,
        food_type.trim(),
        numericQuantity,
        location,
        expiry_time,
        is_discounted || false,
        price || null,
        latitude || null,
        longitude || null
      ]
    );

    const savedFood = food.rows[0];
    res.status(201).json(savedFood);

    setImmediate(async () => {
      try {
        const hasFoodCoordinates = savedFood.latitude !== null && savedFood.longitude !== null;
        const recipients = hasFoodCoordinates
          ? await db.query(
            `WITH recipients AS (
               SELECT
                 phone,
                 notification_mode,
                 latitude,
                 longitude,
                 CASE
                   WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN
                     6371 * acos(
                       LEAST(1, GREATEST(-1,
                         cos(radians($1::float)) *
                         cos(radians(latitude)) *
                         cos(radians(longitude) - radians($2::float)) +
                         sin(radians($1::float)) *
                         sin(radians(latitude))
                       ))
                     )
                   ELSE NULL
                 END AS distance_km
               FROM users
               WHERE role = 'recipient'
                 AND notification_mode = 'whatsapp'
                 AND phone IS NOT NULL
                 AND (
                   regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^[+][1-9][0-9]{7,14}$'
                   OR regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^0[0-9]{8,9}$'
                 )
             ),
             nearby AS (
               SELECT * FROM recipients WHERE distance_km <= $3
             )
             SELECT phone, notification_mode, distance_km
             FROM nearby
             UNION ALL
             SELECT phone, notification_mode, distance_km
             FROM recipients
             WHERE NOT EXISTS (SELECT 1 FROM nearby)
             ORDER BY distance_km ASC NULLS LAST`,
            [savedFood.latitude, savedFood.longitude, NEARBY_RADIUS_KM]
          )
          : await db.query(
            `SELECT phone, notification_mode, NULL AS distance_km
             FROM users
             WHERE role = 'recipient'
               AND notification_mode = 'whatsapp'
               AND phone IS NOT NULL
               AND (
                 regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^[+][1-9][0-9]{7,14}$'
                 OR regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^0[0-9]{8,9}$'
               )`
          );

        const mapLink = savedFood.latitude && savedFood.longitude
          ? `https://www.google.com/maps?q=${savedFood.latitude},${savedFood.longitude}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedFood.location || "")}`;

        const message = [
          "New Food Available!",
          `Food: ${savedFood.food_type}`,
          `Quantity: ${savedFood.quantity}`,
          `Location: ${savedFood.location || "GPS Location"}`,
          "",
          "Open in Google Maps:",
          mapLink
        ].join("\n");

        recipients.rows.forEach((recipient) => {
          if (recipient.phone && recipient.notification_mode === "whatsapp") {
            sendWhatsApp(recipient.phone, message).then((result) => {
              if (!result.ok) {
                console.error("FOOD NOTIFICATION SEND ERROR:", result.error);
              }
            });
          }
        });
      } catch (err) {
        console.error("FOOD NOTIFICATION ERROR:", err.message);
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPostedFood = async (req, res) => {
  try {
    const donor_id = req.user.id;

    logActivity({
      userId: donor_id,
      activityType: "view_posted_food",
      source: "donor_food_list"
    });

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
