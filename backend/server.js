const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =======================
// ROUTES
// =======================
app.use("/api/auth", require("./src/routes/authRoutes"));
app.use("/api/recipient", require("./src/routes/recipientRoutes"));
app.use("/api/food", require("./src/routes/foodRoutes"));
app.use("/api/user", require("./src/routes/userRoutes"));
app.use("/api/admin", require("./src/routes/adminRoutes"));

// 🔥 ADD THIS LINE (CRITICAL FIX)
app.use("/api/analytics", require("./src/routes/analyticsRoutes"));

// =======================
// AUTO EXPIRE FOOD JOB
// =======================
const updateExpiredFood = require("./utils/foodExpiryUpdater");

setInterval(() => {
  updateExpiredFood();
}, 60 * 1000);

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});