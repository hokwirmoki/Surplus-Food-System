const db = require("../config/db");
const { createSandboxPayment } = require("../../utils/paymentService");

exports.createSandboxPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      provider,
      phone,
      amount,
      purpose,
      foodId,
      metadata,
    } = req.body;

    if (!purpose || !["claim", "verification"].includes(purpose)) {
      return res.status(400).json({ message: "Payment purpose must be claim or verification." });
    }

    const payment = await createSandboxPayment(db, {
      userId,
      provider,
      phone,
      amount,
      purpose,
      foodId: foodId || null,
      metadata: metadata || {},
    });

    res.status(201).json({
      message: "Sandbox payment completed successfully.",
      payment: {
        id: payment.id,
        reference: payment.reference,
        providerReference: payment.provider_reference,
        provider: payment.provider,
        phone: payment.phone,
        amount: Number(payment.amount),
        currency: payment.currency,
        purpose: payment.purpose,
        status: payment.status,
        mode: payment.mode,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({
      message: err.message || "Payment failed.",
    });
  }
};
