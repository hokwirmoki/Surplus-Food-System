const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

function normalizeWhatsAppPhone(phone) {
  const trimmed = String(phone || "").trim().replace(/\s+/g, "");

  if (!INTERNATIONAL_PHONE_REGEX.test(trimmed)) {
    return null;
  }

  return trimmed;
}

// ==============================
// WHATSAPP (ACTIVE)
// ==============================
const sendWhatsApp = async (phone, message) => {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!normalizedPhone) {
    console.warn(`WhatsApp skipped: invalid phone number "${phone}". Use international format, e.g. +256...`);
    return;
  }

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP,
      to: `whatsapp:${normalizedPhone}`,
      body: message
    });

    console.log("WhatsApp sent to:", normalizedPhone);

  } catch (err) {
    console.error("WhatsApp error:", err.message);
  }
};

module.exports = { sendWhatsApp };
