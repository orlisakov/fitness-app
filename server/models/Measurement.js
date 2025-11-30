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
    ThighCircumference: { type: Number },
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
  }
);

module.exports = mongoose.model("Measurement", measurementSchema);
