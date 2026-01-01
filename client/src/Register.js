// src/Register.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./styles/auth.css";
import logo from "./logo.jpg";
import config from "./config";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("trainee");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const name = fullName.trim();
    const tel = phone.replace(/\D/g, ""); // ספרות בלבד
    if (name.length < 2) return "נא להזין שם תקין";
    if (tel.length < 9 || tel.length > 11) return "נא להזין טלפון תקין";
    if (password.length < 6) return "סיסמה חייבת להיות לפחות 6 תווים";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setOk("");

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const body = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        password,
        role,
      };

      const res = await fetch(`${config.apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // נקרא תגובה פעם אחת באופן בטוח
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        setError(data.message || `שגיאה בהרשמה (סטטוס ${res.status})`);
        setLoading(false);
        return;
      }

      setOk("נרשמת בהצלחה! אפשר לעבור למסך ההתחברות.");
      setFullName("");
      setPhone("");
      setPassword("");
      setRole("trainee");
    } catch {
      setError("שגיאת רשת");
    } finally {
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
        <form className="auth2-card" onSubmit={handleSubmit} noValidate>
          <img className="auth2-logo" src={logo} alt="לוגו" />
          <h2 className="auth2-title">הרשמה</h2>

          {error && (
            <div className="auth2-alert auth2-alert-error">{error}</div>
          )}
          {ok && <div className="auth2-alert auth2-alert-ok">{ok}</div>}

          <label className="auth2-label">שם מלא</label>
          <input
            className="auth2-input same-size-input"
            type="text"
            placeholder="שם ושם משפחה"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />

          <label className="auth2-label">טלפון</label>
          <input
            className="auth2-input same-size-input"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />

          <label className="auth2-label">תפקיד</label>
          <select
            className="auth2-input same-size-input"
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
            className="auth2-input same-size-input"
            type={showPass ? "text" : "password"}
            placeholder="לפחות 6 תווים"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
