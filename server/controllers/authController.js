const Coach = require("../models/coach");
const Trainee = require("../models/trainee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/** Normalize customSplit coming from client */
function normalizeCustomSplit(input) {
  if (!input) return { mode: "auto" };
  const mode = input?.mode === "custom" ? "custom" : "auto";
  if (mode === "auto") return { mode: "auto" };
  const n = (v) => (v === "" || v == null ? undefined : Number(v));
  const m = input.meals || {};
  const meals = {
    breakfast: {
      protein: n(m?.breakfast?.protein),
      carbs: n(m?.breakfast?.carbs),
      fat: n(m?.breakfast?.fat),
    },
    lunch: {
      protein: n(m?.lunch?.protein),
      carbs: n(m?.lunch?.carbs),
      fat: n(m?.lunch?.fat),
    },
    snack: {
      protein: n(m?.snack?.protein),
      carbs: n(m?.snack?.carbs),
      fat: n(m?.snack?.fat),
    },
    dinner: {
      protein: n(m?.dinner?.protein),
      carbs: n(m?.dinner?.carbs),
      fat: n(m?.dinner?.fat),
    },
  };
  const any = Object.values(meals).some(
    (x) => (x.protein ?? 0) || (x.carbs ?? 0) || (x.fat ?? 0),
  );
  return any ? { mode: "custom", meals } : { mode: "auto" };
}

exports.register = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      role,
      dailyCalories,
      proteinGrams,
      carbGrams,
      fatGrams,
      password,
      customSplit,
    } = req.body;

    const Model = role === "coach" ? Coach : Trainee;

    const phoneStr = normalizePhone(phone);

    // check unique phone inside model
    const existingUser = await Model.findOne({ phone: phoneStr });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const plainPassword = password?.trim() ? password : "123456";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const newUserData = {
      fullName,
      phone: phoneStr,
      role: role || (Model === Coach ? "coach" : "trainee"),
      passwordHash: hashedPassword,
      dailyCalories,
      proteinGrams,
      carbGrams,
      fatGrams,
      customSplit: normalizeCustomSplit(customSplit),
    };

    const newUser = new Model(newUserData);
    await newUser.save();

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET missing in .env" });
    }

    const token = jwt.sign(
      { _id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(201).json({
      user: {
        _id: newUser._id,
        fullName: newUser.fullName,
        phone: newUser.phone,
        role: newUser.role,
        dailyCalories: newUser.dailyCalories,
        proteinGrams: newUser.proteinGrams,
        carbGrams: newUser.carbGrams,
        fatGrams: newUser.fatGrams,
        customSplit: newUser.customSplit,
      },
      token,
      initialPassword: password?.trim() ? undefined : "123456",
    });
  } catch (err) {
    console.error("❌ Error in register:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const normalizePhone = (p) =>
  String(p || "")
    .replace(/\D/g, "")
    .trim();

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const phoneStr = normalizePhone(phone);
    const phoneNum = Number(phoneStr);

    console.log("LOGIN body:", req.body);
    console.log("phoneStr:", phoneStr, "phoneNum:", phoneNum);

    let user =
      (await Coach.findOne({
        $or: [{ phone: phoneStr }, { phone: phoneNum }],
      })) ||
      (await Trainee.findOne({
        $or: [{ phone: phoneStr }, { phone: phoneNum }],
      }));

    console.log("found user?", !!user, "dbPhone:", user?.phone);

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const hash = user.passwordHash || user.password; // תמיכה גם בישן אם יש

    console.log("hash fields:", {
      hasPasswordHash: !!user?.passwordHash,
      hasPassword: !!user?.password,
    });

    const isMatch = await bcrypt.compare(password, hash);
    console.log(
      "COMPARE result:",
      isMatch,
      "passwordLen:",
      String(password ?? "").length,
    );

    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET missing in .env" });
    }

    const token = jwt.sign(
      { _id: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
