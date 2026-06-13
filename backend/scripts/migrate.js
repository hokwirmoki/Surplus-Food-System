const db = require('../src/config/db');

async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                phone TEXT,
                location TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                notification_mode TEXT DEFAULT 'whatsapp',
                verification_status TEXT DEFAULT 'unverified',
                documents JSONB,
                verification_approved_at TIMESTAMP,
                verification_expires_at TIMESTAMP,
                otp_code INTEGER,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS food_items (
                id SERIAL PRIMARY KEY,
                donor_id INTEGER REFERENCES users(id),
                food_type TEXT NOT NULL,
                quantity VARCHAR(50) NOT NULL,
                location TEXT,
                expiry_time TIMESTAMP,
                status TEXT DEFAULT 'available',
                is_discounted BOOLEAN DEFAULT FALSE,
                discount_price DECIMAL(10,2),
                claimed_by INTEGER REFERENCES users(id),
                pickup_status TEXT DEFAULT 'not_picked',
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS location TEXT,
            ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS notification_mode TEXT DEFAULT 'whatsapp',
            ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified',
            ADD COLUMN IF NOT EXISTS documents JSONB,
            ADD COLUMN IF NOT EXISTS verification_approved_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS otp_code INTEGER,
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await db.query(`
            ALTER TABLE food_items
            ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS discount_price DECIMAL(10,2),
            ADD COLUMN IF NOT EXISTS claimed_by INTEGER REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS pickup_status TEXT DEFAULT 'not_picked',
            ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                type TEXT NOT NULL,
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

        await db.query(`
            CREATE TABLE IF NOT EXISTS claims (
                id SERIAL PRIMARY KEY,
                food_id INTEGER REFERENCES food_items(id),
                recipient_id INTEGER REFERENCES users(id),
                quantity INTEGER DEFAULT 1,
                status TEXT DEFAULT 'claimed',
                reservation_fee_paid BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                reference TEXT NOT NULL UNIQUE,
                provider_reference TEXT,
                provider TEXT NOT NULL,
                phone TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency TEXT DEFAULT 'UGX',
                purpose TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                mode TEXT DEFAULT 'sandbox',
                user_id INTEGER REFERENCES users(id),
                food_id INTEGER REFERENCES food_items(id),
                metadata JSONB,
                consumed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            ALTER TABLE claims
            ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'claimed',
            ADD COLUMN IF NOT EXISTS reservation_fee_paid BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await db.query(`
            ALTER TABLE transactions
            ADD COLUMN IF NOT EXISTS payment_id INTEGER REFERENCES payments(id),
            ADD COLUMN IF NOT EXISTS payment_provider TEXT,
            ADD COLUMN IF NOT EXISTS payment_reference TEXT
        `);

        await db.query(`
            UPDATE users
            SET
                verification_approved_at = COALESCE(verification_approved_at, NOW()),
                verification_expires_at = COALESCE(verification_expires_at, NOW() + INTERVAL '1 year')
            WHERE role = 'donor'
              AND verification_status = 'verified'
              AND verification_expires_at IS NULL
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_food_items_donor_status_created
            ON food_items (donor_id, status, created_at DESC)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_food_items_available_expiry
            ON food_items (status, expiry_time)
            WHERE status = 'available'
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_claims_food_id
            ON claims (food_id)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_claims_recipient_created
            ON claims (recipient_id, created_at DESC)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_transactions_food_id
            ON transactions (food_id)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_reference
            ON payments (reference)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_user_purpose_created
            ON payments (user_id, purpose, created_at DESC)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_user_activity_user_created
            ON user_activity (user_id, created_at DESC)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_verification_expiry
            ON users (role, verification_status, verification_expires_at)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users (email)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_users_role_notification_coords
            ON users (role, notification_mode, latitude, longitude)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_food_items_available_coords
            ON food_items (status, latitude, longitude, expiry_time)
            WHERE status = 'available'
        `);

        console.log('Migration completed');
    } catch (err) {
        console.error('Migration error:', err);
        throw err;
    }
}

if (require.main === module) {
    migrate().finally(() => db.end());
}

module.exports = migrate;
