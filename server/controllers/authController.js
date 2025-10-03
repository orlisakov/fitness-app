const Coach = require("../models/coach");
const Trainee = require("../models/trainee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
    } = req.body;

    const Model = role === "coach" ? Coach : Trainee;

    // בדיקת משתמש קיים לפי טלפון
    const existingUser = await Model.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // יצירת משתמש חדש עם סיסמה מוצפנת
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserData = {
      fullName,
      phone,
      passwordHash: hashedPassword,
      dailyCalories,
      proteinGrams,
      carbGrams,
      fatGrams,
    };

    const newUser = new Model(newUserData);
    await newUser.save();

    const token = jwt.sign({ id: newUser._id, role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      user: {
        _id: newUser._id,
        fullName: newUser.fullName,
        phone: newUser.phone,
        role,
      },
      token,
    });
  } catch (err) {
    console.error("❌ Error in register:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    let user = await Coach.findOne({ phone });
    let role = "coach";

    if (!user) {
      user = await Trainee.findOne({ phone });
      role = "trainee";
    }

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        dailyCalories: user.dailyCalories,
        proteinGrams: user.proteinGrams,
        carbGrams: user.carbGrams,
        fatGrams: user.fatGrams,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
