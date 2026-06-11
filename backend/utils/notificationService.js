const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);


// ==============================
// WHATSAPP (ACTIVE)
// ==============================
const sendWhatsApp = async (phone, message) => {
  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP,
      to: `whatsapp:${phone}`,
      body: message
    });

    console.log("WhatsApp sent to:", phone);

  } catch (err) {
    console.error("WhatsApp error:", err.message);
  }
};

module.exports = { sendWhatsApp };