const express = require('express');
const cors = require('cors');
const path = require('path');
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";
const migrate = require('../scripts/migrate');

const app = express();

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Database connection
const pool = require('./config/db');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected at:', res.rows[0].now);
    }
});

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const foodRoutes = require('./routes/foodRoutes');
app.use('/api/food', foodRoutes);

const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);

const recipientRoutes = require("./routes/recipientRoutes");
app.use("/api/recipient", recipientRoutes);

const userRoutes = require("./routes/userRoutes");
app.use("/api/user", userRoutes);

const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

const paymentRoutes = require("./routes/paymentRoutes");
app.use("/api/payments", paymentRoutes);

const updateExpiredFood = require("../utils/foodExpiryUpdater");
setInterval(() => {
    updateExpiredFood({ force: true });
}, 60 * 1000);

// Default route
app.get('/', (req, res) => {
    res.send('SFS Backend Running');
});

// Start server
const PORT = process.env.PORT || 5000;

(async () => {
    await migrate();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})();
