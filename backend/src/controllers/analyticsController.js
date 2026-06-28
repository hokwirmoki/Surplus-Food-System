const db = require("../config/db");

function toTimeRange(hour) {
  const startHour = ((hour % 24) + 24) % 24;
  const endHour = (startHour + 3) % 24;
  const format = (value) => String(value).padStart(2, "0") + ":00";
  return `${format(startHour)} - ${format(endHour)}`;
}

function getWindowStartHour(date) {
  return Math.floor(date.getHours() / 3) * 3;
}

function getDelayHours(createdAt, claimedAt) {
  const start = new Date(createdAt).getTime();
  const end = claimedAt ? new Date(claimedAt).getTime() : Date.now();
  const diffHours = (end - start) / (1000 * 60 * 60);

  if (!Number.isFinite(diffHours) || diffHours < 0) {
    return 0;
  }

  return diffHours;
}

function buildTimingRecommendation(historyRows) {
  if (!historyRows.length) {
    return {
      bestPostingWindow: "11:00 - 14:00",
      windowInsights: []
    };
  }

  const windowStats = new Map();

  for (const row of historyRows) {
    const createdAt = new Date(row.created_at);
    const claimedAt = row.claimed_at ? new Date(row.claimed_at) : null;
    const isClaimed = Boolean(claimedAt);
    const isDiscounted = Boolean(row.is_discounted);
    const windowLabel = toTimeRange(getWindowStartHour(createdAt));
    const delayHours = getDelayHours(createdAt, claimedAt);

    if (!windowStats.has(windowLabel)) {
      windowStats.set(windowLabel, {
        window: windowLabel,
        totalPosts: 0,
        claimedPosts: 0,
        discountedPosts: 0,
        discountedClaims: 0,
        totalDelayHours: 0,
        claimedDelayHours: 0
      });
    }

    const stats = windowStats.get(windowLabel);
    stats.totalPosts += 1;
    stats.totalDelayHours += delayHours;

    if (isClaimed) {
      stats.claimedPosts += 1;
      stats.claimedDelayHours += delayHours;
    }

    if (isDiscounted) {
      stats.discountedPosts += 1;
      if (isClaimed) {
        stats.discountedClaims += 1;
      }
    }
  }

  const insights = Array.from(windowStats.values()).map((stats) => {
    const claimRate = stats.totalPosts ? stats.claimedPosts / stats.totalPosts : 0;
    const discountRate = stats.discountedPosts ? stats.discountedClaims / stats.discountedPosts : 0;
    const averageClaimDelay = stats.claimedPosts
      ? stats.claimedDelayHours / stats.claimedPosts
      : stats.totalDelayHours / stats.totalPosts;

    const score = (claimRate * 100) + (discountRate * 25) - averageClaimDelay - ((stats.totalPosts - stats.claimedPosts) * 4);

    return {
      window: stats.window,
      score: Number(score.toFixed(2)),
      totalPosts: stats.totalPosts,
      claimedPosts: stats.claimedPosts,
      discountedPosts: stats.discountedPosts,
      discountedClaims: stats.discountedClaims,
      averageClaimDelayHours: Number(averageClaimDelay.toFixed(2))
    };
  }).sort((left, right) => right.score - left.score || right.claimedPosts - left.claimedPosts);

  return {
    bestPostingWindow: insights[0]?.window || "11:00 - 14:00",
    windowInsights: insights
  };
}

function isVerifiedDonor(user) {
  return (
    user?.verification_status === "verified" &&
    user?.verification_expires_at &&
    new Date(user.verification_expires_at).getTime() > Date.now()
  );
}

function parseQuantityValue(value) {
  const parsed = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseQuantityUnit(value) {
  const match = String(value || "").toLowerCase().match(/[a-z]+/);
  const unit = match ? match[0] : "";
  const aliases = {
    kilograms: "kg",
    kilogram: "kg",
    kgs: "kg",
    grams: "g",
    gram: "g",
    litres: "litre",
    liters: "litre",
    liter: "litre",
    crates: "crate",
    sacks: "sack",
    bunches: "bunch",
    pieces: "piece",
    boxes: "box",
    packs: "pack",
    packets: "packet",
    trays: "tray",
    servings: "serving",
    plates: "plate",
    loaves: "loaf",
    bottles: "bottle"
  };

  return aliases[unit] || unit;
}

function formatAmount(value) {
  return String(Number(value.toFixed(2))).replace(/\.0+$/, "");
}

function formatPostedQuantity(row) {
  const remainingAmount = row.quantity_amount === null || row.quantity_amount === undefined
    ? parseQuantityValue(row.quantity)
    : Number(row.quantity_amount);
  const claimedAmount = Number(row.claimed_qty || 0);
  const totalAmount = remainingAmount + claimedAmount;
  const unit = row.quantity_unit || parseQuantityUnit(row.quantity);

  if (!unit) {
    return formatAmount(totalAmount);
  }

  const pluralLabels = {
    litre: "litres",
    crate: "crates",
    sack: "sacks",
    bunch: "bunches",
    piece: "pieces",
    box: "boxes",
    pack: "packs",
    packet: "packets",
    tray: "trays",
    serving: "servings",
    plate: "plates",
    loaf: "loaves",
    bottle: "bottles"
  };
  const label = ["kg", "g"].includes(unit) || totalAmount === 1
    ? unit
    : (pluralLabels[unit] || `${unit}s`);

  return `${formatAmount(totalAmount)} ${label}`;
}

exports.getDonorAnalytics = async (req, res) => {
  try {
    const donor_id = req.user.id;

    const donorResult = await db.query(
      `SELECT verification_status, verification_expires_at FROM users WHERE id = $1 AND role = 'donor'`,
      [donor_id]
    );

    if (!isVerifiedDonor(donorResult.rows[0])) {
      return res.status(403).json({
        message: "Your donor account must be verified before viewing analytics."
      });
    }

    // ---------------- DONATION IMPACT ----------------
    const impactTotals = await db.query(
      `WITH claimed_by_food AS (
         SELECT food_id, COALESCE(SUM(quantity), 0) AS claimed_qty
         FROM claims
         GROUP BY food_id
       ),
       food_impact AS (
         SELECT
           f.*,
           COALESCE(
             f.estimated_unit_weight_kg,
             f.estimated_weight_kg / NULLIF(f.quantity_amount, 0),
             0.5
           ) AS unit_weight_kg,
           COALESCE(c.claimed_qty, 0) AS claimed_qty
         FROM food_items f
         LEFT JOIN claimed_by_food c ON c.food_id = f.id
         WHERE f.donor_id = $1
       )
       SELECT
         COALESCE(SUM(
           COALESCE(estimated_weight_kg, COALESCE(CAST(NULLIF(regexp_replace(quantity, '[^0-9\\.]', '', 'g'), '') AS numeric), 0) * 0.5)
           + claimed_qty * unit_weight_kg
         ), 0) AS donated_kg,
         COALESCE(SUM(claimed_qty * unit_weight_kg), 0) AS claimed_kg
       FROM food_impact`,
      [donor_id]
    );

    // ---------------- PEOPLE HELPED ----------------
    const peopleHelped = await db.query(
      `SELECT COUNT(DISTINCT c.recipient_id)
       FROM claims c
       JOIN food_items f ON f.id = c.food_id
       WHERE f.donor_id = $1`,
      [donor_id]
    );

    // ---------------- HISTORY ----------------
    const history = await db.query(
      `WITH claims_by_food AS (
         SELECT
           food_id,
           COALESCE(SUM(quantity), 0) AS claimed_qty,
           MAX(created_at) AS claimed_at
         FROM claims
         GROUP BY food_id
       )
       SELECT
         f.id,
         f.food_type,
         f.quantity,
         f.quantity_amount,
         f.quantity_unit,
         COALESCE(cb.claimed_qty, 0) AS claimed_qty,
         f.status,
         f.is_discounted,
         f.created_at,
         cb.claimed_at
       FROM food_items f
       LEFT JOIN claims_by_food cb ON cb.food_id = f.id
       WHERE f.donor_id = $1
       ORDER BY f.created_at DESC`,
      [donor_id]
    );

    const historyRows = history.rows.map((row) => ({
      id: row.id,
      food_type: row.food_type,
      quantity: formatPostedQuantity(row),
      status: row.status,
      is_discounted: row.is_discounted,
      created_at: row.created_at,
      claimed_at: row.claimed_at
    }));

    res.json({
      totalDonated: Number(Number(impactTotals.rows[0].donated_kg || 0).toFixed(2)),
      totalClaimed: Number(Number(impactTotals.rows[0].claimed_kg || 0).toFixed(2)),
      peopleHelped: Number(peopleHelped.rows[0].count),
      history: historyRows,
      predictive: buildTimingRecommendation(historyRows)
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
