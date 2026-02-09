// server/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "אין טוקן" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ נרמול אחיד של המשתמש
    req.user = {
      id: decoded.id || decoded._id, // <-- זה החלק החשוב
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "טוקן לא תקין" });
  }
};
