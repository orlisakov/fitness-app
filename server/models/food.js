// server/models/food.js
const mongoose = require("mongoose");

const servingSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "חצי קוטג'", "ביצה שלמה"
  quantity: { type: Number, required: true }, // יחסי לבסיס
  displayText: { type: String, required: true }, // "125 גרם (חצי קוטג')"
});

const foodSchema = new mongoose.Schema({
  // בסיס ותאימות לאחור
  name: { type: String, required: true },
  calories: { type: Number, required: true }, // לקילו-100g או ל"יחידת בסיס" (להגדרה ב-servingInfo)
  protein: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  categories: [{ type: String }],

  // מידע הגשה
  servingInfo: {
    baseUnit: {
      type: String,
      enum: ["gram", "piece", "cup", "tablespoon", "ml"],
      required: true,
      default: "gram",
    },
    baseQuantity: { type: Number, required: true, default: 100 }, // ברירת מחדל 100 גרם
    displayName: { type: String, required: true, default: "100 גרם" },
    commonServings: [servingSchema],
  },

  // ערכים פר 100 גרם (אופציונלי)
  nutritionPer100g: {
    calories: { type: Number },
    protein: { type: Number },
    fat: { type: Number },
    carbs: { type: Number },
  },

  // אילוצי הגשה
  constraints: {
    minServing: { type: Number, default: 0.5 },
    maxServing: { type: Number, default: 5 },
    // increment נשמר לשימוש עתידי – האלגוריתם לא משתמש בו כרגע
    increment: { type: Number, default: 0.5 },
  },

  // התאמה לארוחות (0-10)
  mealSuitability: {
    breakfast: { type: Number, min: 0, max: 10, default: 5 },
    lunch: { type: Number, min: 0, max: 10, default: 5 },
    dinner: { type: Number, min: 0, max: 10, default: 5 },
    snack: { type: Number, min: 0, max: 10, default: 5 },
  },

  // מטא
  preparationTime: { type: Number, default: 5 },
  cost: { type: Number, min: 1, max: 5, default: 3 },
  availability: { type: Number, min: 1, max: 5, default: 4 },

  alternatives: [{ type: mongoose.Schema.Types.ObjectId, ref: "food" }],

  lastUpdated: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },

  // דגלי רגישות (אופציונלי)
  dietaryFlags: {
    isVegan: { type: Boolean, default: false },
    isVegetarian: { type: Boolean, default: false },
    isGlutenFree: { type: Boolean, default: false },
    isLactoseFree: { type: Boolean, default: false },
    isKeto: { type: Boolean, default: false },
    isLowCarb: { type: Boolean, default: false },
  },
});

foodSchema.virtual("nutritionalDensity").get(function () {
  const totalMacros = (this.protein || 0) + (this.carbs || 0) + (this.fat || 0);
  return totalMacros > 0 ? (this.calories || 0) / totalMacros : 0;
});

foodSchema.methods.calculateNutrition = function (quantity) {
  const multiplier = quantity / (this.servingInfo?.baseQuantity || 100);
  return {
    calories: Math.round((this.calories || 0) * multiplier),
    protein: Math.round((this.protein || 0) * multiplier * 10) / 10,
    fat: Math.round((this.fat || 0) * multiplier * 10) / 10,
    carbs: Math.round((this.carbs || 0) * multiplier * 10) / 10,
  };
};

foodSchema.methods.getDisplayText = function (quantity) {
  const cs = (this.servingInfo?.commonServings || []).find(
    (s) => Math.abs(s.quantity - quantity) < 0.1
  );
  if (cs) return cs.displayText;

  const baseQty = this.servingInfo?.baseQuantity || 100;
  const unitLabel =
    (this.servingInfo?.displayName || "100 גרם").split(" ")[1] || "גרם";
  const actual = Math.round(quantity * baseQty);

  if (this.servingInfo?.baseUnit === "piece") {
    return quantity === 1 ? `${this.name}` : `${quantity} ${this.name}`;
  }
  return `${actual} ${unitLabel}`;
};

foodSchema.statics.findForMeal = function (mealType, minSuitability = 6) {
  const q = { isActive: true };
  q[`mealSuitability.${mealType}`] = { $gte: minSuitability };
  return this.find(q);
};

foodSchema.index({ categories: 1 });
foodSchema.index({ "mealSuitability.breakfast": 1 });
foodSchema.index({ "mealSuitability.lunch": 1 });
foodSchema.index({ "mealSuitability.dinner": 1 });
foodSchema.index({ "mealSuitability.snack": 1 });
foodSchema.index({ isActive: 1 });

module.exports = mongoose.model("food", foodSchema);
