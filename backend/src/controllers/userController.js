const db = require("../config/db");
const bcrypt = require("bcrypt");
const expireVerificationBadges = require("../../utils/verificationExpiry");
const {
  createSandboxPayment,
  consumeSuccessfulPayment,
} = require("../../utils/paymentService");

exports.updateUser = async (req, res) => {
  try {
    const user_id = req.user.id;
    const userRole = req.user.role;

    let { name, email, phone, password, notification_mode, location, latitude, longitude } = req.body;

    name = name?.trim() || null;
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    location = location?.trim() || null;

    const parsedLatitude = latitude === undefined || latitude === null || latitude === ""
      ? null
      : Number(latitude);
    const parsedLongitude = longitude === undefined || longitude === null || longitude === ""
      ? null
      : Number(longitude);

    const hasCoordinates = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);

    let hashedPassword = null;

    if (password && password.trim() !== "") {
      if (password.length < 4) {
        return res.status(400).json({
          message: "Password must be at least 4 characters"
        });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name) {
      fields.push(`name = $${index++}`);
      values.push(name);
    }

    if (email) {
      fields.push(`email = $${index++}`);
      values.push(email);
    }

    if (phone) {
      fields.push(`phone = $${index++}`);
      values.push(phone);
    }

    if (hashedPassword) {
      fields.push(`password = $${index++}`);
      values.push(hashedPassword);
    }

    if (notification_mode) {
      fields.push(`notification_mode = $${index++}`);
      values.push(notification_mode);
    }

    if (location && userRole !== 'admin') {
      fields.push(`location = $${index++}`);
      values.push(location);

      if (hasCoordinates) {
        fields.push(`latitude = $${index++}`);
        values.push(parsedLatitude);

        fields.push(`longitude = $${index++}`);
        values.push(parsedLongitude);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        message: "No valid fields provided"
      });
    }

    values.push(user_id);

    const query = `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING id, name, email, phone, role, notification_mode, location, latitude, longitude
    `;

    const result = await db.query(query, values);

    res.json({
      message: "Profile updated successfully",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    await expireVerificationBadges();

    const user_id = req.user.id;
    const result = await db.query(
      `SELECT
         id,
         name,
         email,
         phone,
         role,
         location,
         latitude,
         longitude,
         notification_mode,
         verification_status,
         verification_approved_at,
         verification_expires_at,
         documents
       FROM users
       WHERE id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('GET CURRENT USER ERROR:', err);
    res.status(500).json({ error: 'Failed to retrieve user' });
  }
};

// ============================
// DONOR VERIFICATION APPLICATION
// ============================
exports.applyForVerification = async (req, res) => {
  const client = await db.connect();

  try {
    await expireVerificationBadges();
    await client.query("BEGIN");

    const user_id = req.user.id;

    const { vendorType, document, paymentProvider, paymentContact, paid, paymentReference } = req.body;

    const currentUser = await client.query(
      `SELECT verification_status, verification_expires_at FROM users WHERE id = $1`,
      [user_id]
    );

    if (
      currentUser.rows[0]?.verification_status === 'verified' &&
      currentUser.rows[0]?.verification_expires_at &&
      new Date(currentUser.rows[0].verification_expires_at) > new Date()
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Your donor badge is still active. You can apply again after it expires."
      });
    }

    if (!paid && !paymentReference) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Complete the verification payment before submitting your application."
      });
    }

    const payment = paymentReference
      ? await consumeSuccessfulPayment(client, {
        reference: paymentReference,
        userId: user_id,
        purpose: "verification",
        amount: 50000,
      })
      : await createSandboxPayment(client, {
        userId: user_id,
        provider: paymentProvider,
        phone: paymentContact,
        amount: 50000,
        purpose: "verification",
        metadata: { vendorType },
        consume: true,
      });

    // store documents as JSON with type, payment info, and uploaded file info
    const documents = {
      type: vendorType,
      document,
      paymentProvider: payment.provider,
      paymentContact: payment.phone,
      paymentReference: payment.reference,
      paymentStatus: payment.status
    };

    const result = await client.query(
      `UPDATE users
       SET verification_status = 'pending',
           documents = $1,
           verification_approved_at = NULL,
           verification_expires_at = NULL
       WHERE id = $2
       RETURNING id, name, email, phone, role, verification_status, verification_approved_at, verification_expires_at, documents`,
      [documents, user_id]
    );

    await client.query(
      `INSERT INTO transactions
       (type, amount, user_id, payment_id, payment_provider, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['verification', 50000, user_id, payment.id, payment.provider, payment.reference]
    );

    await client.query("COMMIT");
    res.json({ message: 'Verification application submitted', user: result.rows[0] });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("VERIFICATION ROLLBACK ERROR:", rollbackErr.message);
    }
    console.error('VERIFICATION APPLICATION ERROR:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Failed to submit verification application'
    });
  } finally {
    client.release();
  }
};
