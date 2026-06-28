const DEFAULT_EMISSION_FACTOR = 2.5;

const EMISSION_FACTORS_KG_CO2E = {
  "Cooked Meals": DEFAULT_EMISSION_FACTOR,
  Fruits: DEFAULT_EMISSION_FACTOR,
  Vegetables: DEFAULT_EMISSION_FACTOR,
  Bakery: DEFAULT_EMISSION_FACTOR,
  Dairy: DEFAULT_EMISSION_FACTOR,
  Meat: DEFAULT_EMISSION_FACTOR,
  Grains: DEFAULT_EMISSION_FACTOR,
  Beverages: DEFAULT_EMISSION_FACTOR,
  Snacks: DEFAULT_EMISSION_FACTOR,
  Other: DEFAULT_EMISSION_FACTOR
};

const UNIT_ALIASES = {
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  gram: "g",
  grams: "g",
  litre: "litre",
  litres: "litre",
  liter: "litre",
  liters: "litre",
  crates: "crate",
  sacks: "sack",
  bunches: "bunch",
  pieces: "piece",
  pcs: "piece",
  boxes: "box",
  packs: "pack",
  packets: "packet",
  trays: "tray",
  servings: "serving",
  plates: "plate",
  loaves: "loaf",
  bottles: "bottle"
};

const UNIT_LABELS = {
  kg: "kg",
  g: "g",
  litre: "litre",
  crate: "crate",
  sack: "sack",
  bunch: "bunch",
  piece: "piece",
  box: "box",
  pack: "pack",
  packet: "packet",
  tray: "tray",
  serving: "serving",
  plate: "plate",
  loaf: "loaf",
  bottle: "bottle"
};

const BASE_UNIT_WEIGHTS_KG = {
  kg: 1,
  g: 0.001,
  litre: 1,
  crate: 20,
  sack: 50,
  bunch: 0.5,
  piece: 0.2,
  box: 5,
  pack: 1,
  packet: 1,
  tray: 4,
  serving: 0.5,
  plate: 0.5,
  loaf: 0.6,
  bottle: 1
};

const CATEGORY_UNIT_WEIGHTS_KG = {
  Fruits: {
    piece: 0.18,
    crate: 20,
    bunch: 1.2,
    pack: 1
  },
  Vegetables: {
    piece: 0.15,
    crate: 20,
    bunch: 0.5,
    sack: 25
  },
  Bakery: {
    piece: 0.12,
    pack: 0.8,
    box: 3,
    loaf: 0.6
  },
  Dairy: {
    litre: 1.03,
    bottle: 1,
    pack: 0.5
  },
  Beverages: {
    litre: 1,
    bottle: 1,
    crate: 12
  },
  Grains: {
    sack: 50,
    packet: 1,
    pack: 1
  },
  "Cooked Meals": {
    serving: 0.5,
    plate: 0.5,
    tray: 4,
    pack: 0.7,
    box: 2
  },
  Snacks: {
    piece: 0.08,
    packet: 0.15,
    pack: 0.5,
    box: 2
  }
};

const UNIT_CONFIDENCE = {
  kg: "high",
  g: "high",
  litre: "high",
  crate: "medium",
  sack: "medium",
  tray: "medium",
  serving: "medium",
  plate: "medium",
  loaf: "medium",
  bottle: "medium",
  box: "low",
  pack: "low",
  packet: "low",
  bunch: "low",
  piece: "low"
};

function round(value, decimals = 2) {
  return Number(Number(value).toFixed(decimals));
}

function normalizeUnit(unit) {
  const normalized = String(unit || "").trim().toLowerCase();
  return UNIT_ALIASES[normalized] || normalized;
}

function parseQuantityText(quantity) {
  const text = String(quantity || "");
  const amountMatch = text.match(/[0-9]+(?:\.[0-9]+)?/);
  const unitMatch = text.toLowerCase().match(/[a-z]+/);

  return {
    amount: amountMatch ? Number(amountMatch[0]) : NaN,
    unit: normalizeUnit(unitMatch ? unitMatch[0] : "")
  };
}

function formatAmount(amount) {
  return String(round(amount, 2)).replace(/\.0+$/, "");
}

function formatQuantity(amount, unit) {
  const label = UNIT_LABELS[unit] || unit || "unit";
  const plural = amount === 1 || ["kg", "g"].includes(label) ? label : `${label}s`;
  return `${formatAmount(amount)} ${plural}`;
}

function getUnitWeightKg(unit, foodType) {
  return CATEGORY_UNIT_WEIGHTS_KG[foodType]?.[unit] || BASE_UNIT_WEIGHTS_KG[unit] || 1;
}

function estimateFoodImpact({ foodType, quantityAmount, quantityUnit, quantity }) {
  const parsed = parseQuantityText(quantity);
  const amount = Number(quantityAmount || parsed.amount);
  const unit = normalizeUnit(quantityUnit || parsed.unit || "serving");

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Quantity amount must be a positive number.");
  }

  const unitWeightKg = getUnitWeightKg(unit, foodType);
  const estimatedWeightKg = amount * unitWeightKg;
  const emissionFactor = DEFAULT_EMISSION_FACTOR;
  const co2eSavedKg = estimatedWeightKg * emissionFactor;
  const confidence = UNIT_CONFIDENCE[unit] || "low";

  return {
    quantityAmount: round(amount, 2),
    quantityUnit: unit,
    quantityDisplay: formatQuantity(amount, unit),
    estimatedUnitWeightKg: round(unitWeightKg, 3),
    estimatedWeightKg: round(estimatedWeightKg, 2),
    emissionFactorKgCo2ePerKg: round(emissionFactor, 2),
    co2eSavedKg: round(co2eSavedKg, 2),
    confidence,
    method: `Estimated from ${formatQuantity(amount, unit)} at ${round(unitWeightKg, 3)} kg per ${UNIT_LABELS[unit] || unit}, then multiplied by the FAO-derived average factor of ${round(emissionFactor, 2)} kgCO2e/kg.`
  };
}

module.exports = {
  EMISSION_FACTORS_KG_CO2E,
  estimateFoodImpact
};
