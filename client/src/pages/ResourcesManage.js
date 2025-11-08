// src/pages/ResourcesManage.jsx
import React, { useEffect, useState } from "react";
import config from "../config";

export default function ResourcesManage() {
  const api = config.apiBaseUrl;

  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("");

  // טופס העלאה
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = {
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };

  const loadCategories = () =>
    fetch(`${api}/api/resources/categories/list`, { headers })
      .then((r) => r.json())
      .then((arr) => setCategories(arr.filter(Boolean))) // בלי ריק
      .catch(() => {});

  const load = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (catFilter.trim()) p.set("category", catFilter.trim());
    fetch(`${api}/api/resources${p.toString() ? `?${p}` : ""}`, { headers })
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e))))
      .then(setList)
      .catch((e) => setError(e?.message || "שגיאה בטעינת קבצים"));
  };

  useEffect(() => {
    load();
    loadCategories();
  }, [q, catFilter]); // eslint-disable-line

  const remove = (id) => {
    if (!window.confirm("למחוק את המשאב?")) return;
    fetch(`${api}/api/resources/${id}`, { method: "DELETE", headers })
      .then((r) =>
        r.ok
          ? (load(), loadCategories())
          : r.json().then((e) => Promise.reject(e))
      )
      .catch((e) => alert(e?.message || "שגיאה במחיקה"));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!title.trim()) return setError("חסרה כותרת");
    if (!file) return setError("בחרי קובץ להעלאה");

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("visibility", visibility);
      fd.append("tags", tagsText);
      fd.append("category", category.trim());
      fd.append("file", file);

      const res = await fetch(`${api}/api/resources`, {
        method: "POST",
        headers,
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "שגיאה בהעלאה");
      }

      setSuccess("הקובץ הועלה בהצלחה!");
      setTitle("");
      setDescription("");
      setTagsText("");
      setVisibility("all");
      setCategory("");
      setFile(null);
      load();
      loadCategories();
    } catch (err) {
      setError(err.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div dir="rtl" style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: 16 }}>ניהול קבצים</h1>

      {/* טופס העלאה בתוך המסגרת הורודה בלבד */}
      <form
        onSubmit={onSubmit}
        className="card-pink"
        style={{ marginBottom: 24, maxWidth: 900 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            gap: "10px 12px",
            alignItems: "center",
          }}
        >
          <label>כותרת *</label>
          <input
            className="ui-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם המשאב (למשל: איך לבנות צלחת מאוזנת)"
          />

          <label>תיאור</label>
          <textarea
            className="ui-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור קצר למתאמנת"
          />

          <label>תגיות</label>
          <input
            className="ui-input"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="למשל: תפריט, התחלה, צלחת-מאוזנת"
          />

          <label>קטגוריה</label>
          <input
            className="ui-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="למשל: מתכונים / מדריכים / טפסים"
            list="categoryOptions"
          />
          <datalist id="categoryOptions">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <label>נראות</label>
          <select
            className="ui-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="all">לכולם</option>
            <option value="trainee">למתאמנות בלבד</option>
            <option value="coach">למאמנת בלבד</option>
          </select>

          <label>קובץ *</label>
          <input
            className="ui-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {file && (
          <div style={{ marginTop: 8, color: "#7a4860" }}>
            נבחר: <b>{file.name}</b> — {Math.round(file.size / 1024)}KB
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            className="btn-link secondary"
            type="submit"
            disabled={uploading}
          >
            {uploading ? "מעלה…" : "העלאה"}
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setTitle("");
              setDescription("");
              setTagsText("");
              setVisibility("all");
              setCategory("");
              setFile(null);
              setError("");
              setSuccess("");
            }}
          >
            איפוס
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 10, color: "#c62828", fontWeight: 600 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginTop: 10, color: "#2e7d32", fontWeight: 600 }}>
            {success}
          </div>
        )}
      </form>

      {/* חיפוש + קטגוריות – באותה שורה ובאותו גובה */}
      <div className="filter-row" style={{ marginBottom: 12 }}>
        <input
          className="ui-input"
          style={{ minWidth: 320 }}
          placeholder="חיפוש לפי כותרת/תיאור/תגיות…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="ui-select"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn-link" onClick={load}>
          סנן
        </button>
      </div>

      {/* טבלה */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>כותרת</th>
              <th>תיאור</th>
              <th>תגיות</th>
              <th>קטגוריה</th>
              <th>נראות</th>
              <th>נוצר</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id}>
                <td>{r.title}</td>
                <td>{r.description || "-"}</td>
                <td>
                  {Array.isArray(r.tags) && r.tags.length
                    ? r.tags.join(", ")
                    : "-"}
                </td>
                <td>{r.category || "-"}</td>
                <td>{r.visibility || "all"}</td>
                <td>
                  {r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString("he-IL")
                    : "-"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.fileUrl ? (
                    <>
                      <a
                        className="btn-link secondary"
                        href={`${api}${r.fileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        צפייה
                      </a>{" "}
                      <a
                        className="btn-link"
                        href={`${api}${r.fileUrl}`}
                        download={r.originalName || r.title || "resource"}
                      >
                        הורדה
                      </a>{" "}
                    </>
                  ) : (
                    <span style={{ color: "#7a4860" }}>—</span>
                  )}
                  <button
                    className="btn-link danger"
                    onClick={() => remove(r._id)}
                  >
                    מחיקה
                  </button>
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan="7">אין תוצאות.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
