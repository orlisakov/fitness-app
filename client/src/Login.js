// src/Login.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./styles/auth.css"; // ← קובץ סגנונות חדש ומבודד
import logo from "./assets/logo.jpg";
import config from "./config";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();
      console.log("login response:", data);

      if (!res.ok) {
        setError(data.message || "שגיאה בהתחברות");
        setLoading(false);
        return;
      }

      // אם הטוקן כולל את המילה Bearer, נוריד אותה:
      const cleanToken = data.token?.replace(/^Bearer\s+/i, "");
      sessionStorage.setItem("token", cleanToken);

      // אפשר לשמור גם ב-localStorage כדי שישמר אחרי רענון:
      localStorage.setItem("token", cleanToken);

      onLogin?.(data);
    } catch (err) {
      setError("שגיאת רשת");
      setLoading(false);
    }
  };

  return (
    <div className="auth2-container" dir="rtl">
      {/* צד שמאל – תמונת אווירה + כותרת */}
      <aside className="auth2-hero">
        <div className="auth2-hero-overlay">
          <h1 className="auth2-hero-title">ברוכה הבאה</h1>
          <p className="auth2-hero-subtitle">
            מתחברות וממשיכות לתוכנית האישית שלך
          </p>
        </div>
      </aside>

      {/* צד ימין – כרטיס התחברות */}
      <main className="auth2-panel">
        <form className="auth2-card" onSubmit={handleSubmit}>
          <img className="auth2-logo" src={logo} alt="לוגו" />
          <h2 className="auth2-title">התחברות</h2>

          {error && (
            <div className="auth2-alert auth2-alert-error">{error}</div>
          )}

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
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="auth2-button" type="submit" disabled={loading}>
            {loading ? "מתחברת…" : "התחבר"}
          </button>

          <div className="auth2-divider" />

          {/* 
<p className="auth2-bottom-text">
  אין לך חשבון? <Link to="/register">להרשמה</Link>
</p>
*/}
        </form>
      </main>
    </div>
  );
}
