// src/pages/CoachWorkouts.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import config from "../config";
import { getToken } from "../utils/auth";

const LVLS = [
  { key: "beginner", label: "מתחילות" },
  { key: "intermediate", label: "בינוניות" },
  { key: "advanced", label: "מתקדמות" },
];

export default function CoachWorkouts() {
  const [level, setLevel] = useState("beginner");
  const [plans, setPlans] = useState([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0); // ← פרוגרס

  const token = getToken();

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${config.apiBaseUrl}/api/workouts?level=${level}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPlans(data?.plans || []);
    } catch (e) {
      alert(e.response?.data?.message || "שגיאה בטעינת קבצים");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, token]);

  async function uploadPdf(e) {
    e.preventDefault();
    if (!file) return alert("בחרי PDF");
    if (file.type !== "application/pdf")
      return alert("אפשר להעלות רק קובץ PDF");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title?.trim() || file.name.replace(/\.pdf$/i, ""));
    fd.append("level", level);

    setLoading(true);
    setUploadPct(0);
    try {
      await axios.post(`${config.apiBaseUrl}/api/workouts/upload`, fd, {
        headers: { Authorization: `Bearer ${token}` },
        // אל תקבעי Content-Type ידנית—axios יוסיף boundary לבד
        onUploadProgress: (evt) => {
          if (!evt.total) return; // בדפדפנים מסוימים total לא קיים
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setUploadPct(pct);
        },
        timeout: 0,
      });

      // ניקוי שדות
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadPct(100);

      await load();
    } catch (e) {
      alert(e.response?.data?.message || "שגיאה בהעלאה");
    } finally {
      // השהייה קצרה כדי לראות 100% ואז לאפס
      setTimeout(() => setUploadPct(0), 600);
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("למחוק את הקובץ?")) return;
    setLoading(true);
    try {
      await axios.delete(`${config.apiBaseUrl}/api/workouts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "שגיאה במחיקה");
    } finally {
      setLoading(false);
    }
  }

  // פתיחת PDF דרך Authorization Header (בלי ?token=)
  async function openPlan(plan, asDownload = false) {
    const tk = getToken();
    if (!tk) {
      alert("נדרש להתחבר מחדש (לא נמצא טוקן)");
      return;
    }
    const url = `${config.apiBaseUrl}/api/workouts/file/${plan._id}`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${tk}` },
      responseType: "blob",
    });

    const blob = new Blob([resp.data], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    if (asDownload) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = (plan.filename || `${plan.title}.pdf`).replace(
        /[^\w.\-()\s\u0590-\u05FF]/g,
        ""
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(blobUrl, "_blank", "noopener,noreferrer");
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  return (
    <div
      dir="rtl"
      className="container"
      style={{ maxWidth: 900, margin: "24px auto" }}
    >
      <h1>תכניות אימונים שלי</h1>

      {/* כפתורי דרגות עם הדגשה ל-active */}
      <div
        className="tabs"
        style={{ display: "flex", gap: 8, margin: "12px 0" }}
      >
        {LVLS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLevel(l.key)}
            disabled={loading && level !== l.key}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              cursor: "pointer",
              backgroundColor: level === l.key ? "#c2185b" : "#f3f3f3",
              color: level === l.key ? "white" : "black",
              fontWeight: level === l.key ? 700 : 500,
              transition: "background-color 0.3s, color 0.3s",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* טופס העלאה + פס התקדמות */}
      <form
        onSubmit={uploadPdf}
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          margin: "8px 0 16px",
        }}
      >
        <input
          type="text"
          placeholder="כותרת (אופציונלי)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) =>
            setFile((e.target.files && e.target.files[0]) || null)
          }
          disabled={loading}
        />
        <button type="submit" disabled={loading || !file}>
          {loading ? "מעלה…" : "העלאת PDF"}
        </button>

        {/* פס התקדמות */}
        {uploadPct > 0 && (
          <div
            style={{
              width: 260,
              height: 8,
              background: "#eee",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${uploadPct}%`,
                height: 8,
                borderRadius: 999,
                background: "#c2185b",
                transition: "width .15s linear",
              }}
            />
          </div>
        )}
        {uploadPct > 0 && (
          <span style={{ fontSize: 12, color: "#666" }}>{uploadPct}%</span>
        )}
      </form>

      {loading && plans.length === 0 ? (
        <div>טוען…</div>
      ) : plans.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {plans.map((p) => (
            <li
              key={p._id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleString("he-IL")
                    : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openPlan(p, false)}>פתיחה</button>
                {/* <button onClick={() => openPlan(p, true)}>הורדה</button> */}
                <button onClick={() => remove(p._id)} className="danger">
                  מחיקה
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div>אין קבצים לרמה הזו עדיין.</div>
      )}
    </div>
  );
}
