const db = require('../config/db');

class FoodItem {
    static async create(data) {
        const { donor_id, food_type, quantity, location, expiry_time } = data;

        const result = await db.query(
            `INSERT INTO food_items 
            (donor_id, food_type, quantity, location, expiry_time, status)
            VALUES ($1, $2, $3, $4, $5, 'available')
            RETURNING *`,
            [donor_id, food_type, quantity, location, expiry_time]
        );

        return result.rows[0];
    }

    static async getAvailableByDonor(donor_id) {
        const result = await db.query(
            `SELECT * FROM food_items 
             WHERE donor_id = $1 AND status = 'available'
             ORDER BY created_at DESC`,
            [donor_id]
        );

        return result.rows;
    }
}

module.exports = FoodItem;