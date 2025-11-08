// server/models/Resource.js
const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    visibility: {
      type: String,
      enum: ["all", "trainee", "coach"],
      default: "all",
    },
    category: { type: String, default: "", index: true },
    fileUrl: String,
    originalName: String,
    mimeType: String,
    size: Number,

    createdBy: {
      _id: String,
      name: String,
      role: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resource", resourceSchema);
