const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require("../config/db");
const logActivity = require("../../utils/activityLogger");
const expireVerificationBadges = require("../../utils/verificationExpiry");

const { sendWhatsApp, normalizeWhatsAppPhone } = require("../../utils/notificationService");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 2);

function hasOtpExpired(user) {
    if (!user?.otp_expires_at) {
        return false;
    }

    return new Date(user.otp_expires_at).getTime() <= Date.now();
}

async function deleteUserDependencies(client, userId) {
  const donationRecordsTable = await client.query(
    `SELECT to_regclass('public.donation_records') AS table_name`
  );
  const hasDonationRecords = Boolean(donationRecordsTable.rows[0]?.table_name);

  const donorFood = await client.query(
    `SELECT id FROM food_items WHERE donor_id = $1`,
    [userId]
  );
  const donorFoodIds = donorFood.rows.map((food) => food.id);

  if (donorFoodIds.length > 0) {
    await client.query(
      `DELETE FROM transactions WHERE food_id = ANY($1::int[])`,
      [donorFoodIds]
    );

    await client.query(
      `DELETE FROM claims WHERE food_id = ANY($1::int[])`,
      [donorFoodIds]
    );

    if (hasDonationRecords) {
      await client.query(
        `DELETE FROM donation_records WHERE food_id = ANY($1::int[])`,
        [donorFoodIds]
      );
    }

    await client.query(
      `DELETE FROM payments WHERE food_id = ANY($1::int[])`,
      [donorFoodIds]
    );

    await client.query(
      `DELETE FROM food_items WHERE id = ANY($1::int[])`,
      [donorFoodIds]
    );
  }

  await client.query(
    `DELETE FROM claims WHERE recipient_id = $1`,
    [userId]
  );

  await client.query(
    `UPDATE food_items SET claimed_by = NULL WHERE claimed_by = $1`,
    [userId]
  );

  await client.query(
    `DELETE FROM transactions WHERE user_id = $1`,
    [userId]
  );

  await client.query(
    `DELETE FROM payments WHERE user_id = $1`,
    [userId]
  );

  await client.query(
    `DELETE FROM user_activity WHERE user_id = $1`,
    [userId]
  );

  await client.query(
    `DELETE FROM users WHERE id = $1`,
    [userId]
  );
}

async function deleteUserAccount(userId) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await deleteUserDependencies(client, userId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function issueOtp(userId, phone) {
    const otp = Math.floor(100000 + Math.random() * 900000);

    await db.query(
        `UPDATE users
         SET otp_code = $1,
             otp_expires_at = NOW() + ($2::int * INTERVAL '1 minute'),
             is_verified = false
         WHERE id = $3`,
        [otp, OTP_EXPIRY_MINUTES, userId]
    );

    const result = await sendWhatsApp(
        phone,
        `Your SFS verification OTP is: ${otp}`
    );

    return result;
}

// ========================
// REGISTER (WITH DB OTP)
// ========================
exports.register = async (req, res) => {
    try {
        const { name, password, role, phone, location, latitude, longitude } = req.body;
        const email = req.body.email?.trim().toLowerCase();
        const normalizedPhone = normalizeWhatsAppPhone(phone);

        if (!normalizedPhone) {
            return res.status(400).json({
                message: "Use a WhatsApp number like +256700000000 or 0700000000"
            });
        }

        let existingUser = await User.findByEmail(email);
        if (existingUser) {
            if (!existingUser.is_verified && hasOtpExpired(existingUser)) {
                await deleteUserAccount(existingUser.id);
                existingUser = null;
            }
        }

        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            phone: normalizedPhone,
            location,
            latitude,
            longitude,
            notification_mode: 'whatsapp'
        });

        const otpResult = await issueOtp(user.id, normalizedPhone);

        if (!otpResult.ok) {
            return res.status(201).json({
                message: "Account created, but OTP could not be sent. Check the WhatsApp number or Twilio setup.",
                userId: user.id,
                otpSent: false
            });
        }

        res.status(201).json({
            message: "User registered successfully. OTP sent.",
            userId: user.id,
            otpSent: true
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resendOtp = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        const result = await db.query(
            `SELECT id, phone, is_verified, otp_expires_at FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];

        if (user.is_verified) {
            return res.status(400).json({ message: "Account is already verified." });
        }

        if (hasOtpExpired(user)) {
            await deleteUserAccount(user.id);
            return res.status(410).json({
                message: "OTP expired. Please register again."
            });
        }

        const otpResult = await issueOtp(user.id, user.phone);

        if (!otpResult.ok) {
            return res.status(502).json({
                message: "OTP could not be sent. Check the WhatsApp number or Twilio setup."
            });
        }

        return res.json({ message: "OTP sent successfully." });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ========================
// VERIFY OTP (DB BASED)
// ========================
exports.verifyOtp = async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const result = await db.query(
            `SELECT id, otp_code, otp_expires_at, is_verified FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = result.rows[0];
        const dbOtp = user.otp_code;

        if (!dbOtp) {
            return res.status(400).json({ message: "OTP not found. Please request again." });
        }

        if (!user.is_verified && hasOtpExpired(user)) {
            await deleteUserAccount(user.id);
            return res.status(410).json({
                message: "OTP expired. Please register again."
            });
        }

        if (parseInt(otp) !== parseInt(dbOtp)) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // MARK VERIFIED + CLEAR OTP
        await db.query(
            `UPDATE users 
             SET is_verified = true, otp_code = NULL, otp_expires_at = NULL
             WHERE id = $1`,
            [userId]
        );

        return res.json({ message: "Account verified successfully" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ========================
// LOGIN (BLOCK UNVERIFIED)
// ========================
exports.login = async (req, res) => {
    try {
        setImmediate(() => {
            expireVerificationBadges().catch((err) => {
                console.error("VERIFICATION EXPIRY ERROR:", err.message);
            });
        });

        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // BLOCK UNVERIFIED USERS
        if (!user.is_verified) {
            if (hasOtpExpired(user)) {
                await deleteUserAccount(user.id);
                return res.status(410).json({
                    message: "OTP expired. Please register again."
                });
            }

            return res.status(403).json({
                message: "Account not verified. Please verify OTP first."
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                location: user.location,
                latitude: user.latitude,
                longitude: user.longitude,
                notification_mode: user.notification_mode || "whatsapp",
                verification_status: user.verification_status,
                verification_approved_at: user.verification_approved_at,
                verification_expires_at: user.verification_expires_at
            }
        });

        setImmediate(() => {
            logActivity({
                userId: user.id,
                activityType: "login",
                source: "auth",
                metadata: { role: user.role }
            });
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ========================
// UPDATE PROFILE
// ========================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = require("../config/db");

    const { name, email, phone, password, notification_mode } = req.body;

    let hashedPassword = null;

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `
      UPDATE users
      SET
        name = COALESCE(NULLIF($1, ''), name),
        email = COALESCE(NULLIF($2, ''), email),
        phone = COALESCE(NULLIF($3, ''), phone),
        password = COALESCE($4, password),
        notification_mode = COALESCE($5, notification_mode)
      WHERE id = $6
      RETURNING id, name, email, phone, role, notification_mode
      `,
      [
        name || "",
        email || "",
        phone || "",
        hashedPassword,
        notification_mode || null,
        userId
      ]
    );

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// ========================
// DELETE ACCOUNT
// ========================
exports.deleteAccount = async (req, res) => {
  const client = await db.connect();

  try {
    const userId = req.user.id;

    await client.query("BEGIN");

    const donationRecordsTable = await client.query(
      `SELECT to_regclass('public.donation_records') AS table_name`
    );
    const hasDonationRecords = Boolean(donationRecordsTable.rows[0]?.table_name);

    const donorFood = await client.query(
      `SELECT id FROM food_items WHERE donor_id = $1`,
      [userId]
    );
    const donorFoodIds = donorFood.rows.map((food) => food.id);

    if (donorFoodIds.length > 0) {
      await client.query(
        `DELETE FROM transactions WHERE food_id = ANY($1::int[])`,
        [donorFoodIds]
      );

      await client.query(
        `DELETE FROM claims WHERE food_id = ANY($1::int[])`,
        [donorFoodIds]
      );

      if (hasDonationRecords) {
        await client.query(
          `DELETE FROM donation_records WHERE food_id = ANY($1::int[])`,
          [donorFoodIds]
        );
      }

      await client.query(
        `DELETE FROM payments WHERE food_id = ANY($1::int[])`,
        [donorFoodIds]
      );

      await client.query(
        `DELETE FROM food_items WHERE id = ANY($1::int[])`,
        [donorFoodIds]
      );
    }

    await client.query(
      `DELETE FROM claims WHERE recipient_id = $1`,
      [userId]
    );

    await client.query(
      `UPDATE food_items SET claimed_by = NULL WHERE claimed_by = $1`,
      [userId]
    );

    await client.query(
      `DELETE FROM transactions WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `DELETE FROM payments WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `DELETE FROM user_activity WHERE user_id = $1`,
      [userId]
    );

    await client.query(
      `DELETE FROM users WHERE id = $1`,
      [userId]
    );

    await client.query("COMMIT");

    res.json({ message: "Account deleted successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE ACCOUNT ERROR:", err.message);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    client.release();
  }
};
