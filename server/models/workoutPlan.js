const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema({
  title: { type: String, required: true },
  level: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
    required: true,
  },
  // מזהה הקובץ ב-GridFS (files._id)
  gridFsId: { type: mongoose.Schema.Types.ObjectId, required: true },

  // מידע שימושי להצגה/כותרות/בדיקה:
  filename: { type: String },
  contentType: { type: String, default: "application/pdf" },
  length: { type: Number },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Trainee" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);
