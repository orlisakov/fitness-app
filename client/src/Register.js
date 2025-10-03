// src/Register.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./styles/auth.css"; // ← אותו CSS
import logo from "./assets/logo.jpg";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("trainee");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setOk("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, password, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "שגיאה בהרשמה");
        setLoading(false);
        return;
      }

      setOk("נרשמת בהצלחה! אפשר לעבור למסך ההתחברות.");
      setFullName("");
      setPhone("");
      setPassword("");
      setRole("trainee");
      setLoading(false);
    } catch {
      setError("שגיאת רשת");
      setLoading(false);
    }
  };

  return (
    <div className="auth2-container" dir="rtl">
      <aside className="auth2-hero">
        <div className="auth2-hero-overlay">
          <h1 className="auth2-hero-title">נרשמות בדקה</h1>
          <p className="auth2-hero-subtitle">
            כמה פרטים קטנים – וגישה מלאה לאזור האישי
          </p>
        </div>
      </aside>

      <main className="auth2-panel">
        <form className="auth2-card" onSubmit={handleSubmit}>
          <img className="auth2-logo" src={logo} alt="לוגו" />
          <h2 className="auth2-title">הרשמה</h2>

          {error && (
            <div className="auth2-alert auth2-alert-error">{error}</div>
          )}
          {ok && <div className="auth2-alert auth2-alert-ok">{ok}</div>}

          <label className="auth2-label">שם מלא</label>
          <input
            className="auth2-input"
            type="text"
            placeholder="שם ושם משפחה"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <label className="auth2-label">טלפון</label>
          <input
            className="auth2-input"
            type="tel"
            inputMode="tel"
            placeholder="למשל: 054-0000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <label className="auth2-label">תפקיד</label>
          <select
            className="auth2-input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="trainee">מתאמנת</option>
            <option value="coach">מאמנת</option>
          </select>

          <label className="auth2-label auth2-label-row">
            סיסמה
            <button
              type="button"
              className="auth2-text-btn"
              onClick={() => setShowPass((s) => !s)}
            >
              {showPass ? "הסתר" : "הצג"}
            </button>
          </label>
          <input
            className="auth2-input"
            type={showPass ? "text" : "password"}
            placeholder="לפחות 6 תווים"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <button className="auth2-button" type="submit" disabled={loading}>
            {loading ? "נרשמות…" : "הרשמה"}
          </button>

          <div className="auth2-divider" />

          <p className="auth2-bottom-text">
            כבר יש חשבון? <Link to="/login">להתחברות</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
