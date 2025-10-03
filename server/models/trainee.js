const mongoose = require("mongoose");

const traineeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // עכשיו חובה וייחודי
  passwordHash: { type: String, required: true },
  role: { type: String, default: "trainee" },

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

  dislikedFoods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
    },
  ],
});

const Trainee = mongoose.model("Trainee", traineeSchema);

module.exports = Trainee;
