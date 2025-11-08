import React, { useEffect, useState } from "react";
import axios from "axios";
import config from "../config";
import { getToken } from "../utils/auth"; // לא צריך buildDownloadUrl יותר

const LEVEL_LABELS = {
  beginner: "מתחילות",
  intermediate: "בינוניות",
  advanced: "מתקדמות",
};

export default function TraineeWorkouts() {
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const token = getToken();

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!token) {
        setErr("נדרש להתחבר למערכת");
        setLoading(false);
        return;
      }
      try {
        const meRes = await axios.get(`${config.apiBaseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const me = meRes.data?.user || meRes.data;
        if (!ignore) setUser(me);

        const levelQS = me?.trainingLevel
          ? `?level=${encodeURIComponent(me.trainingLevel)}`
          : "";
        const { data } = await axios.get(
          `${config.apiBaseUrl}/api/workouts${levelQS}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!ignore) setPlans(Array.isArray(data?.plans) ? data.plans : []);
      } catch (e) {
        if (!ignore)
          setErr(
            e.response?.data?.message ||
              e.message ||
              "שגיאה בטעינת תוכניות אימון"
          );
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [token]);

  // ← פתיחה דרך Authorization Header
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

  const Skeleton = () => (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="card"
          style={{
            padding: 12,
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: 0.6,
          }}
        >
          <div
            style={{
              height: 14,
              width: 180,
              background: "#eee",
              borderRadius: 6,
            }}
          />
          <div
            style={{
              height: 28,
              width: 100,
              background: "#f3f3f3",
              borderRadius: 8,
            }}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>תוכנית האימונים שלך</h1>

      {user && (
        <div
          style={{
            display: "inline-block",
            background: "#ffe3f0",
            color: "#c2185b",
            borderRadius: 999,
            padding: "6px 12px",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          דרגה: {LEVEL_LABELS[user.trainingLevel] || "מתחילות"}
        </div>
      )}

      {loading ? (
        <Skeleton />
      ) : err ? (
        <div className="dashboard-error" style={{ marginTop: 8 }}>
          {err}
        </div>
      ) : plans.length ? (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
          {plans.map((p) => (
            <li
              key={p._id}
              className="card"
              style={{
                padding: "10px 12px",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                {p.createdAt && (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {new Date(p.createdAt).toLocaleString("he-IL")}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openPlan(p, false)}>פתיחה</button>
                {/* אם תרצי גם להוריד לקובץ: */}
                {/* <button onClick={() => openPlan(p, true)}>הורדה</button> */}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="card"
          style={{ padding: 16, marginTop: 12, textAlign: "center" }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
            אין עדיין תוכנית משויכת
          </div>
          <div style={{ color: "#666" }}>
            ברגע שהמאמנת תשייך לך תוכנית לפי דרגתך, היא תופיע כאן.
          </div>
        </div>
      )}
    </div>
  );
}
