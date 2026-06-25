const twilio = require("twilio");

const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const UGANDA_LOCAL_PHONE_REGEX = /^0\d{8,9}$/;
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || "+256";

function getWhatsAppSender() {
  const sender = String(process.env.TWILIO_WHATSAPP || "").trim();

  if (!sender) {
    return null;
  }

  return sender.startsWith("whatsapp:") ? sender : `whatsapp:${sender}`;
}

function maskPhone(phone) {
  const value = String(phone || "");
  if (value.length <= 7) {
    return value;
  }

  return `${value.slice(0, 4)}${"*".repeat(Math.max(value.length - 7, 0))}${value.slice(-3)}`;
}

function normalizeWhatsAppPhone(phone) {
  const trimmed = String(phone || "").trim().replace(/\s+/g, "");

  if (INTERNATIONAL_PHONE_REGEX.test(trimmed)) {
    return trimmed;
  }

  if (UGANDA_LOCAL_PHONE_REGEX.test(trimmed)) {
    return `${DEFAULT_COUNTRY_CODE}${trimmed.slice(1)}`;
  }

  return null;
}

// WHATSAPP (ACTIVE)
const sendWhatsApp = async (phone, message) => {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const sender = getWhatsAppSender();

  if (!normalizedPhone) {
    if (process.env.DEBUG_NOTIFICATIONS === "true") {
      console.warn(`WhatsApp skipped: invalid phone number "${phone}". Use international format, e.g. +256...`);
    }
    return {
      ok: false,
      error: "Invalid WhatsApp phone number",
      code: "INVALID_PHONE",
      to: null,
    };
  }

  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN || !sender) {
    console.error("WhatsApp error: Twilio environment variables are not fully configured.");
    return {
      ok: false,
      error: "Twilio environment variables are not fully configured",
      code: "TWILIO_CONFIG_MISSING",
      to: normalizedPhone,
    };
  }

  try {
    const client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const result = await client.messages.create({
      from: sender,
      to: `whatsapp:${normalizedPhone}`,
      body: message
    });

    if (process.env.DEBUG_NOTIFICATIONS === "true" || process.env.NODE_ENV !== "production") {
      console.log(
        `WhatsApp accepted: to=${maskPhone(normalizedPhone)} sid=${result.sid} status=${result.status}`
      );
    }
    return {
      ok: true,
      sid: result.sid,
      status: result.status,
      to: normalizedPhone,
    };

  } catch (err) {
    console.error(`WhatsApp error for ${maskPhone(normalizedPhone)}:`, err.message);
    return {
      ok: false,
      error: err.message,
      code: err.code,
      to: normalizedPhone,
    };
  }
};

module.exports = { sendWhatsApp, normalizeWhatsAppPhone, maskPhone };
