const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");
const path = require("path");

dotenv.config();
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

// ראוטים (שימי לב לא לכרוך auth פעמיים בכל ראוטר)
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
app.use("/api/workouts", authMiddleware, require("./routes/workouts"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
