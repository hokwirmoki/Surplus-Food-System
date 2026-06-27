export const FOOD_DIETARY_TYPES = [
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "meat", label: "Contains meat" }
];

export const RECIPIENT_DIETARY_PREFERENCES = [
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "meat_only", label: "Meat only" },
  { value: "avoid_pork", label: "Avoid pork" }
];

export function getDietaryLabel(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "No dietary label";
  if (tags.includes("meat")) return "Contains meat";
  if (tags.includes("vegan")) return "Vegan";
  if (tags.includes("vegetarian")) return "Vegetarian";
  return "No dietary label";
}
