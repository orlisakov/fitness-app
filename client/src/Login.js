// src/Login.jsx
import React, { useState } from "react";
import "./styles/auth.css";
import logo from "./logo.jpg";
import config from "./config";

export default function Login({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ נרמול טלפון: משאיר רק ספרות (053-... / רווחים / וכו')
  const normalizePhone = (p) => String(p || "").replace(/[^\d]/g, "");

  // ✅ fetch עם timeout + ניסיון חוזר (פעם אחת) לתקלות זמניות
  const fetchWithTimeout = async (url, options, timeoutMs = 12000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

  const shouldRetry = (status) => {
    // תקלות שרת/timeout - לא credentials
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    const cleanPhone = normalizePhone(phone);

    try {
      const url = `${config.apiBaseUrl}/api/auth/login`;
      const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, password }),
      };

      let res;
      try {
        res = await fetchWithTimeout(url, options, 12000);
      } catch (err) {
        // timeout / רשת
        // ✅ retry פעם אחת (cold start)
        await new Promise((r) => setTimeout(r, 600));
        res = await fetchWithTimeout(url, options, 12000);
      }

      // נסה לקרוא JSON, אבל אל תיפול אם אין JSON תקין
      let data = {};
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        // ✅ 401 = פרטים שגויים
        if (res.status === 401) {
          setError("טלפון או סיסמה שגויים");
          return;
        }

        // ✅ תקלות זמניות: retry פעם אחת ואז הודעה ידידותית
        if (shouldRetry(res.status)) {
          await new Promise((r) => setTimeout(r, 600));
          const res2 = await fetchWithTimeout(url, options, 12000);

          let data2 = {};
          const text2 = await res2.text();
          try {
            data2 = text2 ? JSON.parse(text2) : {};
          } catch {
            data2 = { message: text2 };
          }

          if (!res2.ok) {
            if (res2.status === 401) {
              setError("טלפון או סיסמה שגויים");
            } else {
              setError("בעיה זמנית בשרת. נסי שוב בעוד כמה שניות.");
            }
            return;
          }

          // הצליח בנסיון השני
          const cleanToken = (data2.token || "").replace(/^Bearer\s+/i, "");
          if (!cleanToken) {
            setError("התחברת אבל לא התקבל טוקן מהשרת");
            return;
          }
          sessionStorage.setItem("token", cleanToken);
          localStorage.setItem("token", cleanToken);
          onLogin?.(data2);
          return;
        }

        // ✅ שאר השגיאות: הודעה כללית
        setError(data?.message || "שגיאה בהתחברות");
        return;
      }

      const cleanToken = (data.token || "").replace(/^Bearer\s+/i, "");
      if (!cleanToken) {
        setError("התחברת אבל לא התקבל טוקן מהשרת");
        return;
      }

      sessionStorage.setItem("token", cleanToken);
      localStorage.setItem("token", cleanToken);
      onLogin?.(data);
    } catch (err) {
      // AbortError / Failed to fetch וכו'
      setError("בעיה זמנית בחיבור לשרת. נסי שוב.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2-container" dir="rtl">
      <aside className="auth2-hero">
        <img
          className="auth2-hero-img"
          src={require("./assets/couch.jpg")}
          alt=""
        />
        <div className="auth2-hero-overlay">
          <h1 className="auth2-hero-title">ברוכה הבאה</h1>
          <p className="auth2-hero-subtitle">
            מתחברות וממשיכות לתוכנית האישית שלך
          </p>
        </div>
      </aside>

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
            placeholder="מספר טלפון"
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
        </form>
      </main>
    </div>
  );
}
