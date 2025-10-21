const mongoose = require("mongoose");

const traineeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: "trainee" },
  trainingLevel: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    default: "beginner",
  },

  // פרטי בריאות
  age: { type: Number },
  height: { type: Number },
  weight: { type: Number },
  isVegetarian: Boolean,
  isVegan: Boolean,
  glutenSensitive: Boolean,
  lactoseSensitive: Boolean,

  // חישוב מאמן
  fatGrams: { type: Number },
  dailyCalories: { type: Number },
  proteinGrams: { type: Number },
  carbGrams: { type: Number },

  // חלוקה ידנית של מאקרו לגרמים לכל ארוחה
  customSplit: {
    mode: { type: String, enum: ["auto", "custom"], default: "auto" },
    meals: {
      breakfast: { protein: Number, carbs: Number, fat: Number },
      lunch: { protein: Number, carbs: Number, fat: Number },
      snack: { protein: Number, carbs: Number, fat: Number },
      dinner: { protein: Number, carbs: Number, fat: Number },
    },
  },

  dislikedFoods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
    },
  ],
});

const Trainee = mongoose.model("Trainee", traineeSchema);

module.exports = Trainee;
