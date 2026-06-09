const db = require('../config/db');
const bcrypt = require('bcrypt');

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
            `SELECT * FROM users WHERE email = $1`,
            [email]
        );

        return result.rows[0];
    }

    static async findById(id) {
        const result = await db.query(
            `SELECT * FROM users WHERE id = $1`,
            [id]
        );

        return result.rows[0];
    }

    static async updateVerificationStatus(id, status, documents) {
        const result = await db.query(
            `UPDATE users SET verification_status = $1, documents = $2 WHERE id = $3 RETURNING *`,
            [status, documents, id]
        );

        return result.rows[0];
    }

    static async getAllUsers() {
        const result = await db.query(
            `SELECT id, name, email, phone, verification_status, documents FROM users WHERE role = 'donor' AND documents IS NOT NULL`
        );

        return result.rows;
    }
}

module.exports = User;