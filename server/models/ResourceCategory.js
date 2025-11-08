//server/models/ResourceCategory.js
const mongoose = require("mongoose");

const ResourceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResourceCategory", ResourceCategorySchema);
