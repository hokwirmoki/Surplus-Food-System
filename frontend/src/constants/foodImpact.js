export const FOOD_WASTE_CO2E_FACTOR = 2.5;

export const FOOD_EMISSION_FACTORS = {
  "Cooked Meals": FOOD_WASTE_CO2E_FACTOR,
  Fruits: FOOD_WASTE_CO2E_FACTOR,
  Vegetables: FOOD_WASTE_CO2E_FACTOR,
  Bakery: FOOD_WASTE_CO2E_FACTOR,
  Dairy: FOOD_WASTE_CO2E_FACTOR,
  Meat: FOOD_WASTE_CO2E_FACTOR,
  Grains: FOOD_WASTE_CO2E_FACTOR,
  Beverages: FOOD_WASTE_CO2E_FACTOR,
  Snacks: FOOD_WASTE_CO2E_FACTOR,
  Other: FOOD_WASTE_CO2E_FACTOR
};

export const QUANTITY_UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "litre", label: "litres" },
  { value: "crate", label: "crates" },
  { value: "sack", label: "sacks" },
  { value: "bunch", label: "bunches" },
  { value: "piece", label: "pieces" },
  { value: "box", label: "boxes" },
  { value: "pack", label: "packs" },
  { value: "packet", label: "packets" },
  { value: "tray", label: "trays" },
  { value: "serving", label: "servings" },
  { value: "loaf", label: "loaves" },
  { value: "bottle", label: "bottles" }
];

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
  loaf: 0.6,
  bottle: 1
};

const CATEGORY_UNIT_WEIGHTS_KG = {
  Fruits: { piece: 0.18, crate: 20, bunch: 1.2, pack: 1 },
  Vegetables: { piece: 0.15, crate: 20, bunch: 0.5, sack: 25 },
  Bakery: { piece: 0.12, pack: 0.8, box: 3, loaf: 0.6 },
  Dairy: { litre: 1.03, bottle: 1, pack: 0.5 },
  Beverages: { litre: 1, bottle: 1, crate: 12 },
  Grains: { sack: 50, packet: 1, pack: 1 },
  "Cooked Meals": { serving: 0.5, tray: 4, pack: 0.7, box: 2 },
  Snacks: { piece: 0.08, packet: 0.15, pack: 0.5, box: 2 }
};

const UNIT_CONFIDENCE = {
  kg: "high",
  g: "high",
  litre: "high",
  crate: "medium",
  sack: "medium",
  tray: "medium",
  serving: "medium",
  loaf: "medium",
  bottle: "medium",
  box: "low",
  pack: "low",
  packet: "low",
  bunch: "low",
  piece: "low"
};

export function getDefaultUnitForCategory(category) {
  if (category === "Fruits" || category === "Vegetables") return "crate";
  if (category === "Grains") return "sack";
  if (category === "Dairy" || category === "Beverages") return "litre";
  if (category === "Bakery") return "loaf";
  if (category === "Cooked Meals") return "serving";
  return "kg";
}

export function estimateFoodImpact(category, amount, unit) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !unit) {
    return null;
  }

  const unitWeightKg = CATEGORY_UNIT_WEIGHTS_KG[category]?.[unit] || BASE_UNIT_WEIGHTS_KG[unit] || 1;
  const estimatedWeightKg = numericAmount * unitWeightKg;
  const emissionFactor = FOOD_EMISSION_FACTORS[category] || FOOD_EMISSION_FACTORS.Other;

  return {
    estimatedWeightKg,
    co2eSavedKg: estimatedWeightKg * emissionFactor,
    emissionFactor,
    confidence: UNIT_CONFIDENCE[unit] || "low"
  };
}
