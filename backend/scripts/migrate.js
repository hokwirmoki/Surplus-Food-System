const db = require('../src/config/db');

async function migrate() {
    try {
        // Add new columns to users table
        await db.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS location TEXT,
            ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS notification_mode TEXT DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
            ADD COLUMN IF NOT EXISTS documents JSONB
        `);

        // Create transactions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL, -- 'reservation', 'verification', 'commission'
                amount DECIMAL(10,2) NOT NULL,
                user_id INTEGER REFERENCES users(id),
                food_id INTEGER REFERENCES food_items(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_activity (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                activity_type TEXT NOT NULL,
                source TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add columns to food_items
        await db.query(`
            ALTER TABLE food_items 
            ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS discount_price DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS claimed_by INTEGER REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS pickup_status TEXT DEFAULT 'not_picked'
        `);

        // Create claims table
        await db.query(`
            CREATE TABLE IF NOT EXISTS claims (
                id SERIAL PRIMARY KEY,
                food_id INTEGER REFERENCES food_items(id),
                recipient_id INTEGER REFERENCES users(id),
                quantity INTEGER DEFAULT 1,
                status TEXT DEFAULT 'claimed', -- 'claimed', 'picked_up'
                reservation_fee_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure existing claims table has quantity column
        await db.query(`
            ALTER TABLE claims
            ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1
        `);

        console.log('Migration completed');
    } catch (err) {
        console.error('Migration error:', err);
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;