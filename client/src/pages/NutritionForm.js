// src/pages/NutritionForm.js
import React, { useEffect, useState } from "react";
import { authHeaders } from "../utils/auth";
import "../styles/theme.css";
import config from "./config";

export default function NutritionForm() {
  const [form, setForm] = useState({
    isVegetarian: false,
    isVegan: false,
    glutenSensitive: false,
    lactoseSensitive: false,
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchNutritionData();
  }, []);

  const fetchNutritionData = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/nutrition/me`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("שגיאה בטעינת נתונים");
      const data = await res.json();
      setForm(data);
    } catch (err) {
      //console.log("אין נתונים קודמים - ממשיכה לטופס ריק");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/nutrition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("שגיאה בשמירת הנתונים");
      setSaved(true);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>טוען טופס...</div>;

  return (
    <div dir="rtl" style={{ padding: "2rem" }}>
      <h2>שאלון תזונתי</h2>
      <form onSubmit={handleSubmit} className="nutrition-form-container">
        <label className="checkbox-line" style={{ fontWeight: "bold" }}>
          <input
            type="checkbox"
            name="isVegetarian"
            checked={editData.isVegetarian}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                isVegetarian: e.target.checked,
              }))
            }
          />
          אני צמחונית
        </label>
        <br />

        <label className="checkbox-line" style={{ fontWeight: "bold" }}>
          <input
            type="checkbox"
            name="isVegan"
            checked={form.isVegan}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                isVegetarian: e.target.checked,
              }))
            }
          />
          אני טבעונית
        </label>
        <br />

        <label className="checkbox-line" style={{ fontWeight: "bold" }}>
          <input
            type="checkbox"
            name="glutenSensitive"
            checked={form.glutenSensitive}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                isVegetarian: e.target.checked,
              }))
            }
          />
          רגישה לגלוטן
        </label>
        <br />

        <label className="checkbox-line" style={{ fontWeight: "bold" }}>
          <input
            type="checkbox"
            name="lactoseSensitive"
            checked={form.lactoseSensitive}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                isVegetarian: e.target.checked,
              }))
            }
          />
          רגישה ללקטוז
        </label>
        <br />
        <br />

        <button type="submit" className="update-btn">
          שמור
        </button>
        {saved && <p style={{ color: "green" }}>✔ הנתונים נשמרו בהצלחה</p>}
      </form>
    </div>
  );
}
