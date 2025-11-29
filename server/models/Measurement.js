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
    imagePath: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Measurement", measurementSchema);
