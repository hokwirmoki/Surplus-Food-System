const crypto = require("crypto");

const SUPPORTED_PROVIDERS = new Set(["MTN", "Airtel"]);
const UG_LOCAL_PHONE_REGEX = /^0(7|3)\d{8}$/;
const UG_INTERNATIONAL_PHONE_REGEX = /^\+256(7|3)\d{8}$/;

function normalizeProvider(provider) {
  const value = String(provider || "").trim().toLowerCase();

  if (value === "mtn") return "MTN";
  if (value === "airtel") return "Airtel";

  return null;
}

function normalizePaymentPhone(phone) {
  const cleaned = String(phone || "").trim().replace(/[\s-]+/g, "");

  if (UG_INTERNATIONAL_PHONE_REGEX.test(cleaned)) {
    return cleaned;
  }

  if (UG_LOCAL_PHONE_REGEX.test(cleaned)) {
    return `+256${cleaned.slice(1)}`;
  }

  return null;
}

function normalizeAmount(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function createReference(provider) {
  const suffix = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `SFS-${provider.toUpperCase()}-${Date.now()}-${suffix}`;
}

async function createSandboxPayment(queryRunner, {
  userId,
  provider,
  phone,
  amount,
  purpose,
  foodId = null,
  metadata = {},
  consume = false,
}) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedPhone = normalizePaymentPhone(phone);
  const normalizedAmount = normalizeAmount(amount);

  if (!normalizedProvider || !SUPPORTED_PROVIDERS.has(normalizedProvider)) {
    const err = new Error("Choose MTN or Airtel as the payment provider.");
    err.status = 400;
    throw err;
  }

  if (!normalizedPhone) {
    const err = new Error("Enter a valid Uganda mobile money number, e.g. 0777123456 or +256777123456.");
    err.status = 400;
    throw err;
  }

  if (!normalizedAmount || normalizedAmount <= 0) {
    const err = new Error("Payment amount must be greater than zero.");
    err.status = 400;
    throw err;
  }

  const reference = createReference(normalizedProvider);
  const providerReference = `SANDBOX-${reference}`;

  const result = await queryRunner.query(
    `INSERT INTO payments
     (reference, provider_reference, provider, phone, amount, currency, purpose, status, mode, user_id, food_id, metadata, consumed_at)
     VALUES ($1, $2, $3, $4, $5, 'UGX', $6, 'successful', 'sandbox', $7, $8, $9, CASE WHEN $10 THEN NOW() ELSE NULL END)
     RETURNING *`,
    [
      reference,
      providerReference,
      normalizedProvider,
      normalizedPhone,
      normalizedAmount,
      purpose,
      userId,
      foodId,
      metadata,
      consume,
    ]
  );

  return result.rows[0];
}

async function consumeSuccessfulPayment(queryRunner, {
  reference,
  userId,
  purpose,
  amount,
  foodId = null,
}) {
  const normalizedAmount = normalizeAmount(amount);

  const result = await queryRunner.query(
    `SELECT *
     FROM payments
     WHERE reference = $1
       AND user_id = $2
     FOR UPDATE`,
    [reference, userId]
  );

  if (result.rows.length === 0) {
    const err = new Error("Payment reference was not found.");
    err.status = 400;
    throw err;
  }

  const payment = result.rows[0];

  if (payment.status !== "successful") {
    const err = new Error("Payment has not been completed successfully.");
    err.status = 400;
    throw err;
  }

  if (payment.consumed_at) {
    const err = new Error("This payment has already been used.");
    err.status = 400;
    throw err;
  }

  if (payment.purpose !== purpose) {
    const err = new Error("Payment purpose does not match this action.");
    err.status = 400;
    throw err;
  }

  if (Number(payment.amount) !== normalizedAmount) {
    const err = new Error("Payment amount does not match this action.");
    err.status = 400;
    throw err;
  }

  if (foodId && Number(payment.food_id) !== Number(foodId)) {
    const err = new Error("Payment does not match this food item.");
    err.status = 400;
    throw err;
  }

  const updated = await queryRunner.query(
    `UPDATE payments
     SET consumed_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [payment.id]
  );

  return updated.rows[0];
}

module.exports = {
  createSandboxPayment,
  consumeSuccessfulPayment,
  normalizeAmount,
  normalizePaymentPhone,
  normalizeProvider,
};
