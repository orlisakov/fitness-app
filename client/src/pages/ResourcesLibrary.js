import React, { useEffect, useMemo, useState } from "react";
import config from "../config";

export default function ResourcesLibrary() {
  const api = config.apiBaseUrl;
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catFilter, setCatFilter] = useState("");
  const [q, setQ] = useState("");

  const headers = {
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };

  // טוען קטגוריות (ללא ריקים)
  function loadCategories() {
    fetch(`${api}/api/resources/categories/list`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr) =>
        setCategories(
          Array.from(new Set((arr || []).filter((c) => c && c.trim())))
        )
      )
      .catch(() => {});
  }

  function load() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (catFilter.trim()) params.set("category", catFilter.trim());
    const url = `${api}/api/resources${params.toString() ? `?${params}` : ""}`;

    fetch(url, { headers })
      .then((res) => res.json())
      .then(setResources)
      .catch((err) => console.error("Error loading resources:", err));
  }

  useEffect(() => {
    load();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, catFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of resources) {
      const key = r.category?.trim() || "ללא קטגוריה";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries());
  }, [resources]);

  const handleDownload = async (r) => {
    try {
      const res = await fetch(`${api}/api/resources/${r._id}/download`, {
        headers,
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Download failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.originalName || r.title || "resource";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("לא ניתן להוריד: " + (e.message || "שגיאה"));
    }
  };

  return (
    <div dir="rtl" style={{ padding: "2rem" }}>
      <h1 style={{ margin: "0 0 24px 0", textAlign: "right" }}>קבצים להורדה</h1>

      {/* 🔹 שורת סינון בלבד */}
      <div className="resources-filter-block" style={{ marginBottom: 20 }}>
        <select
          className="ui-select"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          style={{ width: 180 }}
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          className="search-input"
          placeholder="חיפוש…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 260 }}
        />

        <button className="btn" onClick={load} style={{ height: 42 }}>
          סנן
        </button>
      </div>

      {resources.length === 0 ? (
        <p>אין קבצים להורדה עדיין.</p>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "12px 0" }}>{cat}</h2>

            <ul
              className="resources-grid"
              style={{ listStyle: "none", padding: 0 }}
            >
              {items.map((r) => (
                <li key={r._id} className="resource-card">
                  <div className="resource-header">
                    <div className="resource-title">{r.title}</div>

                    <div className="resource-actions">
                      {r.fileUrl && (
                        <button
                          className="btn-link secondary"
                          onClick={() =>
                            window.open(`${api}${r.fileUrl}`, "_blank")
                          }
                          type="button"
                        >
                          צפייה
                        </button>
                      )}
                      <button
                        className="btn-link"
                        onClick={() => handleDownload(r)}
                        type="button"
                      >
                        הורדה
                      </button>
                    </div>
                  </div>

                  {r.description && (
                    <div className="resource-desc" style={{ marginTop: 6 }}>
                      {r.description}
                    </div>
                  )}

                  {Array.isArray(r.tags) && r.tags.length > 0 && (
                    <div className="resource-tags" style={{ marginTop: 8 }}>
                      {r.tags.map((t, i) => (
                        <span key={i} className="resource-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
