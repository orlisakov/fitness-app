// נקודת כניסה
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();
const app = express();

// התחברות למסד הנתונים
connectDB();

// מידלוור
app.use(cors());
app.use(express.json());

// ראוטים
app.use("/api/auth", require("./routes/auth"));
app.use("/api/trainees", authMiddleware, require("./routes/trainees"));
app.use("/api/coach", authMiddleware, require("./routes/coach"));
app.use(
  "/api/measurements",
  authMiddleware,
  require("./routes/measurementRoutes")
);
app.use("/api/foods", authMiddleware, require("./routes/foodRoutes"));
app.use("/api/meal-plan", authMiddleware, require("./routes/generateMealPlan"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
