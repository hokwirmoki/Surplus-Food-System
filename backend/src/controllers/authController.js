const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require("../config/db");
const logActivity = require("../../utils/activityLogger");
const expireVerificationBadges = require("../../utils/verificationExpiry");

const { sendWhatsApp } = require("../../utils/notificationService");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

// ========================
// REGISTER (WITH DB OTP)
// ========================
exports.register = async (req, res) => {
    try {
        const { name, password, role, phone, location, latitude, longitude } = req.body;
        const email = req.body.email?.trim().toLowerCase();

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            phone,
            location,
            latitude,
            longitude,
            notification_mode: 'whatsapp'
        });

        // ========================
        // OTP GENERATION
        // ========================
        const otp = Math.floor(100000 + Math.random() * 900000);

        // SAVE OTP IN DB
        await db.query(
            `UPDATE users 
             SET otp_code = $1, is_verified = false 
             WHERE id = $2`,
            [otp, user.id]
        );

        // SEND OTP VIA WHATSAPP
        if (phone) {
            await sendWhatsApp(
                phone,
                `Your SFS verification OTP is: ${otp}`
            );
        }

        res.status(201).json({
            message: "User registered successfully. OTP sent.",
            userId: user.id
        });

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
            `SELECT otp_code FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const dbOtp = result.rows[0].otp_code;

        if (!dbOtp) {
            return res.status(400).json({ message: "OTP not found. Please request again." });
        }

        if (parseInt(otp) !== parseInt(dbOtp)) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // MARK VERIFIED + CLEAR OTP
        await db.query(
            `UPDATE users 
             SET is_verified = true, otp_code = NULL 
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
        await expireVerificationBadges();

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

        logActivity({
            userId: user.id,
            activityType: "login",
            source: "auth",
            metadata: { role: user.role }
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
  try {
    const db = require("../config/db");
    const userId = req.user.id;

    await db.query(
      `DELETE FROM donation_records WHERE recipient_id = $1 OR donor_id = $1`,
      [userId]
    );

    await db.query(
      `DELETE FROM food_items WHERE donor_id = $1`,
      [userId]
    );

    await db.query(
      `DELETE FROM users WHERE id = $1`,
      [userId]
    );

    res.json({ message: "Account deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: "Failed to delete account" });
  }
};
