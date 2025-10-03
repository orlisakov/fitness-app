// server/routes/foods.js
const express = require("express");
const router = express.Router();
const Food = require("../models/food");
const authMiddleware = require("../middleware/authMiddleware");

/* ---------- Helpers ---------- */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// אם קלוריות לא נשלחו/0 – נחשב לפי 4/4/9
const fillCaloriesIfMissing = (doc) => {
  const p = toNum(doc.protein, 0);
  const c = toNum(doc.carbs, 0);
  const f = toNum(doc.fat, 0);
  if (!doc.calories || toNum(doc.calories, 0) === 0) {
    doc.calories = Math.round(p * 4 + c * 4 + f * 9);
  }
  return doc;
};

// מיזוג בטוח של שדות מורחבים
const normalizeFoodPayload = (body = {}) => {
  const payload = {
    name: String(body.name || "").trim(),
    calories: toNum(body.calories, 0),
    protein: toNum(body.protein, 0),
    fat: toNum(body.fat, 0),
    carbs: toNum(body.carbs, 0),
    categories: Array.isArray(body.categories) ? body.categories : [],
    cost: toNum(body.cost, 3),
    availability: toNum(body.availability, 4),
    isActive:
      typeof body.isActive === "boolean"
        ? body.isActive
        : body.isActive === "0"
        ? false
        : true,
    servingInfo: {
      baseUnit: body?.servingInfo?.baseUnit || "gram",
      baseQuantity: toNum(body?.servingInfo?.baseQuantity, 100),
      displayName: body?.servingInfo?.displayName || "100 גרם",
      commonServings: Array.isArray(body?.servingInfo?.commonServings)
        ? body.servingInfo.commonServings.map((s) => ({
            name: String(s?.name || ""),
            quantity: toNum(s?.quantity, 1),
            displayText: String(s?.displayText || ""),
          }))
        : [],
    },
    constraints: {
      minServing: toNum(body?.constraints?.minServing, 0.5),
      maxServing: toNum(body?.constraints?.maxServing, 5),
      increment: toNum(body?.constraints?.increment, 0.5),
    },
    mealSuitability: {
      breakfast: toNum(body?.mealSuitability?.breakfast, 5),
      lunch: toNum(body?.mealSuitability?.lunch, 5),
      dinner: toNum(body?.mealSuitability?.dinner, 5),
      snack: toNum(body?.mealSuitability?.snack, 5),
    },
    dietaryFlags: {
      isVegan: !!body?.dietaryFlags?.isVegan,
      isVegetarian: !!body?.dietaryFlags?.isVegetarian,
      isGlutenFree: !!body?.dietaryFlags?.isGlutenFree,
      isLactoseFree: !!body?.dietaryFlags?.isLactoseFree,
      isKeto: !!body?.dietaryFlags?.isKeto,
      isLowCarb: !!body?.dietaryFlags?.isLowCarb,
    },
  };

  return fillCaloriesIfMissing(payload);
};

/* ---------- GET /api/foods ---------- */
/** שליפת מאכלים:
 *  - חיפוש לפי name (?name=)
 *  - פילטר סטטוס isActive (?active=1/0) – ברירת מחדל: הכל
 *  - עמודים (?page=?, ?limit=?)
 */
router.get("/", async (req, res) => {
  try {
    const { name, active, page = 1, limit = 500 } = req.query;

    const query = {};
    if (name) query.name = { $regex: name, $options: "i" };
    if (active === "1") query.isActive = { $ne: false };
    if (active === "0") query.isActive = false;

    const skip = Math.max(0, (Number(page) - 1) * Number(limit));
    const [items, total] = await Promise.all([
      Food.find(query).sort({ name: 1 }).skip(skip).limit(Number(limit)),
      Food.countDocuments(query),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /foods error:", err);
    res.status(500).json({ message: "שגיאה בטעינת המאכלים" });
  }
});

/* ---------- GET /api/foods/:id ---------- */
router.get("/:id", async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: "מאכל לא נמצא" });
    res.json(food);
  } catch (err) {
    res.status(400).json({ message: "שגיאה בשליפת המאכל" });
  }
});

/* ---------- POST /api/foods ---------- */
/** הוספת מאכל – נדרשת הזדהות */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const payload = normalizeFoodPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ message: "שם מאכל חובה" });
    }

    const food = new Food(payload);
    await food.save();
    res.status(201).json(food);
  } catch (err) {
    console.error("POST /foods error:", err);
    res.status(400).json({ message: "שגיאה ביצירת מאכל חדש" });
  }
});

/* ---------- PUT /api/foods/:id ---------- */
/** עדכון מלא של מאכל – נדרשת הזדהות */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const payload = normalizeFoodPayload(req.body);

    const updated = await Food.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "מאכל לא נמצא" });
    res.json(updated);
  } catch (err) {
    console.error("PUT /foods/:id error:", err);
    res.status(400).json({ message: "שגיאה בעדכון המאכל" });
  }
});

/* ---------- PATCH /api/foods/:id ---------- */
/** עדכון חלקי – שימושי כששולחים רק חלק מהשדות */
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    // לא נכריח את כל השדות – ננרמל רק מה שיש
    const current = await Food.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "מאכל לא נמצא" });

    const merged = normalizeFoodPayload({ ...current.toObject(), ...req.body });
    const updated = await Food.findByIdAndUpdate(
      req.params.id,
      { $set: merged },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    console.error("PATCH /foods/:id error:", err);
    res.status(400).json({ message: "שגיאה בעדכון המאכל" });
  }
});

/* ---------- DELETE /api/foods/:id ---------- */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Food.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "מאכל לא נמצא" });
    res.json({ message: "מאכל נמחק בהצלחה" });
  } catch (err) {
    console.error("DELETE /foods/:id error:", err);
    res.status(500).json({ message: "שגיאה במחיקת המאכל" });
  }
});

/* ---------- BULK import (אופציונלי) ---------- */
/** העלאת מערך מאכלים בבת אחת: POST /api/foods/bulk  (דורש הזדהות) */
router.post("/bulk", authMiddleware, async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : req.body.items;
    if (!Array.isArray(list) || !list.length) {
      return res.status(400).json({ message: "לא התקבלו פריטים לייבוא" });
    }
    const docs = list.map((x) => normalizeFoodPayload(x));
    const result = await Food.insertMany(docs, { ordered: false });
    res.status(201).json({ inserted: result.length });
  } catch (err) {
    console.error("BULK /foods error:", err);
    res.status(400).json({ message: "שגיאה בייבוא מאכלים" });
  }
});

module.exports = router;
