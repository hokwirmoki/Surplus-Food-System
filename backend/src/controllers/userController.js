const db = require("../config/db");
const bcrypt = require("bcrypt");

exports.updateUser = async (req, res) => {
  try {
    const user_id = req.user.id;
    const userRole = req.user.role;

    let { name, email, phone, password, notification_mode, location } = req.body;

    name = name?.trim() || null;
    email = email?.trim() || null;
    phone = phone?.trim() || null;
    location = location?.trim() || null;

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
      RETURNING id, name, email, phone, notification_mode, location
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
    const user_id = req.user.id;
    const result = await db.query(
      `SELECT id, name, email, phone, role, location, latitude, longitude, notification_mode, verification_status, documents FROM users WHERE id = $1`,
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
  try {
    const user_id = req.user.id;

    const { vendorType, document, paymentProvider, paymentContact, paid } = req.body;

    // store documents as JSON with type, payment info, and uploaded file info
    const documents = {
      type: vendorType,
      document,
      paymentProvider,
      paymentContact
    };

    const result = await db.query(
      `UPDATE users SET verification_status = 'pending', documents = $1 WHERE id = $2 RETURNING id, name, email, phone, role, verification_status, documents`,
      [documents, user_id]
    );

    if (paid) {
      // record verification payment (50,000 UGX)
      await db.query(
        `INSERT INTO transactions (type, amount, user_id) VALUES ($1, $2, $3)`,
        ['verification', 50000, user_id]
      );
    }

    res.json({ message: 'Verification application submitted', user: result.rows[0] });
  } catch (err) {
    console.error('VERIFICATION APPLICATION ERROR:', err);
    res.status(500).json({ error: 'Failed to submit verification application' });
  }
};