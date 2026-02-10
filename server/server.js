// server/server.js
const express = require("express");
const cors = require("cors");
const app = express();

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

app.use(cors());
app.use(express.json());

const { connectDB } = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");

// ✅ Health check (Warm-up) — הכי מהיר, בלי DB
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ✅ חיבור DB פעם אחת בזמן עליית השרת
connectDB().catch((err) => {
  console.error("❌ Failed to connect DB on boot:", err);
});

// ראוטים
app.use("/api/auth", require("./routes/auth"));
app.use("/api/trainees", authMiddleware, require("./routes/trainees"));
app.use("/api/coach", authMiddleware, require("./routes/coach"));
app.use("/api/measurements", authMiddleware, require("./routes/measurements"));
app.use("/api/foods", authMiddleware, require("./routes/foodRoutes"));
app.use("/api/meal-plan", authMiddleware, require("./routes/generateMealPlan"));
app.use("/api/workouts", authMiddleware, require("./routes/workouts"));
app.use("/api/resources", require("./routes/resources"));
app.use("/api/categories", authMiddleware, require("./routes/categories"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
