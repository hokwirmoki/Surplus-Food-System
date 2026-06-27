const db = require("../config/db");
const updateExpiredFood = require("../../utils/foodExpiryUpdater");
const { sendWhatsApp } = require("../../utils/notificationService");
const logActivity = require("../../utils/activityLogger");

const NEARBY_RADIUS_KM = Number(process.env.NEARBY_RADIUS_KM || 10);
const MIN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function getFoodDietaryTags(dietaryType, containsPork) {
  if (containsPork) return ["meat", "pork"];
  if (dietaryType === "vegan") return ["vegan", "vegetarian"];
  if (dietaryType === "vegetarian") return ["vegetarian"];
  if (dietaryType === "meat") return ["meat"];
  return [];
}

function formatDietaryTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "No dietary label";

  if (tags.includes("pork")) return "Contains pork";
  if (tags.includes("meat")) return "Contains meat";
  if (tags.includes("vegan")) return "Vegan";
  if (tags.includes("vegetarian")) return "Vegetarian";
  return "No dietary label";
}

exports.postFood = async (req, res) => {
  try {
    const donor_id = req.user.id;
    const { food_type, food_description, dietary_type, quantity, expiry_time, is_discounted, price, contains_pork } = req.body;
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

    if (!food_description || !String(food_description).trim()) {
      return res.status(400).json({ message: "Food description is required." });
    }

    if (!["vegan", "vegetarian", "meat"].includes(dietary_type)) {
      return res.status(400).json({ message: "Please select a dietary type for the food." });
    }

    if (contains_pork === undefined || contains_pork === null || contains_pork === "") {
      return res.status(400).json({ message: "Please specify whether the food contains pork." });
    }

    const hasPork = contains_pork === true || contains_pork === "true";

    if (hasPork && dietary_type !== "meat") {
      return res.status(400).json({
        message: "Food marked vegan or vegetarian cannot contain pork."
      });
    }

    const dietaryTags = getFoodDietaryTags(dietary_type, hasPork);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive number." });
    }

    const expiryDate = new Date(expiry_time);

    if (!expiry_time || Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now() + MIN_EXPIRY_BUFFER_MS) {
      return res.status(400).json({
        message: "Expiry time must be more than 5 minutes from now."
      });
    }

    if (is_discounted && !price) {
      return res.status(400).json({
        message: "Discounted food must include a price."
      });
    }

    const food = await db.query(
      `INSERT INTO food_items
      (donor_id, food_type, food_description, dietary_tags, quantity, location, expiry_time, status, contains_pork, is_discounted, discount_price, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        donor_id,
        food_type.trim(),
        food_description.trim(),
        dietaryTags,
        numericQuantity,
        location,
        expiry_time,
        hasPork,
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
        const donorResult = await db.query(
          `SELECT name FROM users WHERE id = $1`,
          [savedFood.donor_id]
        );
        const donorName = donorResult.rows[0]?.name || "A donor";
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
                 AND food_notifications_enabled = true
                 AND notification_mode = 'whatsapp'
                 AND phone IS NOT NULL
                 AND (
                   COALESCE(array_length(preferred_food_types, 1), 0) = 0
                   OR $4 = ANY(preferred_food_types)
                 )
                 AND NOT ((avoid_pork = true OR 'avoid_pork' = ANY(dietary_preferences)) AND $5::boolean = true)
                 AND (
                   COALESCE(array_length(dietary_preferences, 1), 0) = 0
                   OR (
                     (NOT ('vegan' = ANY(dietary_preferences)) OR 'vegan' = ANY($6::text[]))
                     AND (NOT ('vegetarian' = ANY(dietary_preferences)) OR 'vegetarian' = ANY($6::text[]) OR 'vegan' = ANY($6::text[]))
                     AND (NOT ('meat_only' = ANY(dietary_preferences)) OR 'meat' = ANY($6::text[]) OR 'pork' = ANY($6::text[]))
                     AND (NOT ('avoid_pork' = ANY(dietary_preferences)) OR NOT ('pork' = ANY($6::text[])))
                   )
                 )
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
            [savedFood.latitude, savedFood.longitude, NEARBY_RADIUS_KM, savedFood.food_type, savedFood.contains_pork, savedFood.dietary_tags || []]
          )
          : await db.query(
            `SELECT phone, notification_mode, NULL AS distance_km
             FROM users
             WHERE role = 'recipient'
               AND food_notifications_enabled = true
               AND notification_mode = 'whatsapp'
               AND phone IS NOT NULL
               AND (
                 COALESCE(array_length(preferred_food_types, 1), 0) = 0
                 OR $1 = ANY(preferred_food_types)
               )
               AND NOT ((avoid_pork = true OR 'avoid_pork' = ANY(dietary_preferences)) AND $2::boolean = true)
               AND (
                 COALESCE(array_length(dietary_preferences, 1), 0) = 0
                 OR (
                   (NOT ('vegan' = ANY(dietary_preferences)) OR 'vegan' = ANY($3::text[]))
                   AND (NOT ('vegetarian' = ANY(dietary_preferences)) OR 'vegetarian' = ANY($3::text[]) OR 'vegan' = ANY($3::text[]))
                   AND (NOT ('meat_only' = ANY(dietary_preferences)) OR 'meat' = ANY($3::text[]) OR 'pork' = ANY($3::text[]))
                   AND (NOT ('avoid_pork' = ANY(dietary_preferences)) OR NOT ('pork' = ANY($3::text[])))
                 )
               )
               AND (
                 regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^[+][1-9][0-9]{7,14}$'
                 OR regexp_replace(phone, '[[:space:]]+', '', 'g') ~ '^0[0-9]{8,9}$'
               )`,
            [savedFood.food_type, savedFood.contains_pork, savedFood.dietary_tags || []]
          );

        const mapLink = savedFood.latitude && savedFood.longitude
          ? `https://www.google.com/maps?q=${savedFood.latitude},${savedFood.longitude}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedFood.location || "")}`;

        const message = [
          "New Food Available!",
          `Food: ${savedFood.food_type}`,
          `Donor: ${donorName}`,
          `Description: ${savedFood.food_description}`,
          `Dietary: ${formatDietaryTags(savedFood.dietary_tags)}`,
          `Pork: ${savedFood.contains_pork ? "Contains pork" : "No pork"}`,
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
