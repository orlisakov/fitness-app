// src/pages/ResourcesManage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${sessionStorage.getItem("token")}`,
    }),
    []
  );

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/resources/categories/list`, {
        headers,
      });
      const arr = await res.json();
      setCategories((arr || []).filter(Boolean));
    } catch {
      // לא חייבים להפיל UI אם קטגוריות לא נטענו
    }
  }, [api, headers]);

  const load = useCallback(async () => {
    try {
      setError("");
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (catFilter.trim()) p.set("category", catFilter.trim());

      const res = await fetch(
        `${api}/api/resources${p.toString() ? `?${p}` : ""}`,
        { headers }
      );

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "שגיאה בטעינת קבצים");
      }

      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "שגיאה בטעינת קבצים");
      setList([]);
    }
  }, [api, headers, q, catFilter]);

  useEffect(() => {
    load();
    loadCategories();
  }, [load, loadCategories]);

  const remove = async (id) => {
    if (!window.confirm("למחוק את המשאב?")) return;
    try {
      const res = await fetch(`${api}/api/resources/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || "שגיאה במחיקה");
      }
      await load();
      await loadCategories();
    } catch (e) {
      alert(e?.message || "שגיאה במחיקה");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTagsText("");
    setVisibility("all");
    setCategory("");
    setFile(null);
    setError("");
    setSuccess("");
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
      resetForm();
      await load();
      await loadCategories();
    } catch (err) {
      setError(err?.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div dir="rtl" className="resources-manage-page">
      <h1 className="page-title">ניהול קבצים</h1>

      {/* טופס העלאה */}
      <form onSubmit={onSubmit} className="card-pink resources-upload-card">
        <div className="resources-upload-grid">
          <label className="form-label">כותרת *</label>
          <input
            className="ui-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם המשאב (למשל: איך לבנות צלחת מאוזנת)"
          />

          <label className="form-label">תיאור</label>
          <textarea
            className="ui-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור קצר למתאמנת"
          />

          <label className="form-label">תגיות</label>
          <input
            className="ui-input"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="למשל: תפריט, התחלה, צלחת-מאוזנת"
          />

          <label className="form-label">קטגוריה</label>
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

          <label className="form-label">נראות</label>
          <select
            className="ui-select"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="all">לכולם</option>
            <option value="trainee">למתאמנות בלבד</option>
            <option value="coach">למאמנת בלבד</option>
          </select>

          <label className="form-label">קובץ *</label>
          <input
            className="ui-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {file && (
          <div className="muted" style={{ marginTop: 8 }}>
            נבחר: <b>{file.name}</b> — {Math.round(file.size / 1024)}KB
          </div>
        )}

        <div className="resources-actions">
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
            onClick={resetForm}
            disabled={uploading}
          >
            איפוס
          </button>
        </div>

        {error && <div className="dashboard-error">{error}</div>}
        {success && (
          <div
            className="dashboard-message"
            style={{ borderColor: "var(--accent-pink)" }}
          >
            {success}
          </div>
        )}
      </form>

      {/* חיפוש + סינון */}
      <div className="filter-row resources-filter-row">
        <input
          className="ui-input"
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
      </div>

      {/* טבלה */}
      <div className="table-wrapper">
        <table className="history-table narrow preferences-table">
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
                <td colSpan="7" style={{ textAlign: "center" }}>
                  אין תוצאות.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
