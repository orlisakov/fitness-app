const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
  {
    traineeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true },
    AbdominalCircumference: { type: Number },
    TopCircumference: { type: Number },
    ButtockCircumference: { type: Number },
    BodyWeight: { type: Number },
    BodyFatPercentage: { type: Number, min: 0, max: 100 },
    RMR: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "RMR חייב להיות מספר שלם וחיובי בקק״ל ליום",
      },
    },
    ArmCircumference: { type: Number },
    imagePaths: {
      type: [String],
      default: [], // תמיד נחזיר מערך
      validate: [(arr) => arr.length <= 3, "3 תמונות"],
    },
    imagePath: { type: String },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Measurement", measurementSchema);
