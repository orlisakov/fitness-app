const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
  {
    traineeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true },
    weight: { type: Number },
    bodyFat: { type: Number },
    waist: { type: Number },
    hips: { type: Number },
    chest: { type: Number },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Measurement", measurementSchema);
