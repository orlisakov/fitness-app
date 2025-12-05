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
  const [uploadPct, setUploadPct] = useState(0);

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
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setUploadPct(pct);
        },
        timeout: 0,
      });

      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadPct(100);

      await load();
    } catch (e) {
      alert(e.response?.data?.message || "שגיאה בהעלאה");
    } finally {
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

  async function openPlan(plan, asDownload = false) {
    const tk = getToken();
    if (!tk) return alert("נדרש להתחבר מחדש (לא נמצא טוקן)");

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
    <div dir="rtl" className="coach-workouts-page">
      <h1 className="page-title">תכניות אימונים שלי</h1>

      {/* Tabs / Levels */}
      <div className="workouts-tabs">
        {LVLS.map((l) => (
          <button
            key={l.key}
            className={`tab-btn ${level === l.key ? "active" : ""}`}
            onClick={() => setLevel(l.key)}
            disabled={loading && level !== l.key}
            type="button"
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Upload Card */}
      <form onSubmit={uploadPdf} className="card-pink upload-card">
        <div className="upload-row">
          <input
            className="ui-input"
            type="text"
            placeholder="כותרת (אופציונלי)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />

          <input
            ref={fileInputRef}
            className="ui-file"
            type="file"
            accept="application/pdf"
            onChange={(e) =>
              setFile((e.target.files && e.target.files[0]) || null)
            }
            disabled={loading}
          />

          <button
            className="btn-link"
            type="submit"
            disabled={loading || !file}
          >
            {loading ? "מעלה…" : "העלאת PDF"}
          </button>
        </div>

        {/* Progress */}
        {uploadPct > 0 && (
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${uploadPct}%` }} />
            <span className="progress-text">{uploadPct}%</span>
          </div>
        )}
      </form>

      {/* Plans Table */}
      <div className="table-wrap">
        <table className="history-table narrow preferences-table">
          <thead>
            <tr>
              <th>שם התוכנית</th>
              <th>תאריך העלאה</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {loading && plans.length === 0 && (
              <tr>
                <td colSpan="3">טוען…</td>
              </tr>
            )}

            {!loading && plans.length === 0 && (
              <tr>
                <td colSpan="3">אין קבצים לרמה הזו עדיין.</td>
              </tr>
            )}

            {plans.map((p) => (
              <tr key={p._id}>
                <td>{p.title}</td>
                <td>
                  {p.createdAt
                    ? new Date(p.createdAt).toLocaleString("he-IL")
                    : "—"}
                </td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="btn-link secondary"
                    onClick={() => openPlan(p, false)}
                  >
                    פתיחה
                  </button>
                  {/* <button type="button" className="btn-link" onClick={() => openPlan(p, true)}>הורדה</button> */}
                  <button
                    type="button"
                    className="btn-link danger"
                    onClick={() => remove(p._id)}
                  >
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
