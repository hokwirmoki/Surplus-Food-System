const db = require('../config/db');
const bcrypt = require('bcrypt');
const expireVerificationBadges = require('../../utils/verificationExpiry');

class User {
    static async create({ name, email, password, role, phone, location, latitude, longitude, notification_mode }) {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, password, role, phone, location, latitude, longitude, notification_mode, verification_status, is_verified)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                name,
                email,
                hashedPassword,
                role,
                phone,
                location,
                latitude,
                longitude,
                notification_mode || 'whatsapp',
                role === 'admin' ? 'verified' : 'unverified',
                role === 'admin'
            ]
        );

        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await db.query(
            `SELECT
                id,
                name,
                email,
                password,
                phone,
                role,
                location,
                latitude,
                longitude,
                notification_mode,
                verification_status,
                verification_approved_at,
                verification_expires_at,
                is_verified
             FROM users
             WHERE email = $1`,
            [email?.trim().toLowerCase()]
        );

        return result.rows[0];
    }

    static async findById(id) {
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
                is_verified
             FROM users WHERE id = $1`,
            [id]
        );

        return result.rows[0];
    }

    static async updateVerificationStatus(id, status, documents) {
        let result;

        if (status === 'verified') {
            result = await db.query(
                `UPDATE users
                 SET verification_status = 'verified',
                     documents = $1,
                     verification_approved_at = NOW(),
                     verification_expires_at = NOW() + INTERVAL '1 year'
                 WHERE id = $2
                 RETURNING *`,
                [documents, id]
            );
        } else {
            result = await db.query(
                `UPDATE users
                 SET verification_status = $1,
                     documents = $2,
                     verification_approved_at = NULL,
                     verification_expires_at = NULL
                 WHERE id = $3
                 RETURNING *`,
                [status, documents, id]
            );
        }

        return result.rows[0];
    }

    static async getAllUsers() {
        await expireVerificationBadges();

        const result = await db.query(
            `SELECT
                id,
                name,
                email,
                phone,
                verification_status,
                verification_approved_at,
                verification_expires_at,
                documents
             FROM users
             WHERE role = 'donor' AND documents IS NOT NULL
             ORDER BY
                CASE verification_status
                  WHEN 'pending' THEN 1
                  WHEN 'verified' THEN 2
                  WHEN 'expired' THEN 3
                  WHEN 'rejected' THEN 4
                  ELSE 5
                END,
                id DESC`
        );

        return result.rows;
    }
}

module.exports = User;
