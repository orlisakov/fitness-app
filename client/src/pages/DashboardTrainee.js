// client/src/pages/DashboardTrainee.jsx
import React, { useEffect, useState } from "react";
import "../styles/theme.css";

export default function DashboardTrainee() {
  const [trainee, setTrainee] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [allFoods, setAllFoods] = useState([]); // נשמר תמיד כמערך אחרי נרמול
  const [dislikedFoods, setDislikedFoods] = useState([]);
  const [showDislikedFoodsModal, setShowDislikedFoodsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // דגל נעילה כדי למנוע קריאה כפולה
  const [saving, setSaving] = useState(false);

  // ——— Helper: נרמול תשובה מהממשק לצורת מערך עקבית ———
  const toArray = (x) =>
    Array.isArray(x) ? x : x && Array.isArray(x.items) ? x.items : [];

  useEffect(() => {
    fetchTraineeData();
  }, []);

  const fetchTraineeData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "https://fitness-app-wdsh.onrender.com/api/auth/me",
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) throw new Error("שגיאה בשליפת נתוני משתמש");

      const data = await res.json();
      const user = data.user || data;
      if (!user || !user._id) throw new Error("פרטי משתמש לא תקינים");

      setTrainee(user);
      setEditData({
        fullName: user.fullName || "",
        phone: user.phone || "",

        age: user.age ?? "",
        height: user.height ?? "",
        weight: user.weight ?? "",

        isVegetarian: !!user.isVegetarian,
        isVegan: !!user.isVegan,
        glutenSensitive: !!user.glutenSensitive,
        lactoseSensitive: !!user.lactoseSensitive,

        fatGrams: user.fatGrams ?? "",
        dailyCalories: user.dailyCalories ?? "",
        proteinGrams: user.proteinGrams ?? "",
        carbGrams: user.carbGrams ?? "",
      });
    } catch (err) {
      console.error("fetchTraineeData error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeasurements = async () => {
    try {
      const res = await fetch(
        `https://fitness-app-wdsh.onrender.com/api/measurements/${trainee._id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) throw new Error("שגיאה בשליפת ההיסטוריה");
      const data = await res.json();
      setMeasurements(Array.isArray(data) ? data : []);
      setShowHistory(true);
    } catch (err) {
      alert("שגיאה בטעינת מדידות");
    }
  };

  // המרות סוגים בטוחות לפני שליחה
  const toNum = (v) =>
    v === "" || v === null || typeof v === "undefined" ? undefined : Number(v);
  const toBool = (v) => !!v;

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (saving) return; // ✅ מונע הרצה כפולה
    setSaving(true);

    if (!trainee?._id) {
      alert("משתמש לא נטען עדיין");
      setSaving(false);
      return;
    }

    const payload = {
      fullName: editData.fullName ?? "",
      phone: editData.phone ?? "",

      age: toNum(editData.age),
      height: toNum(editData.height),
      weight: toNum(editData.weight),

      isVegetarian: toBool(editData.isVegetarian),
      isVegan: toBool(editData.isVegan),
      glutenSensitive: toBool(editData.glutenSensitive),
      lactoseSensitive: toBool(editData.lactoseSensitive),

      dailyCalories: toNum(editData.dailyCalories),
      fatGrams: toNum(editData.fatGrams),
      proteinGrams: toNum(editData.proteinGrams),
      carbGrams: toNum(editData.carbGrams),
    };

    Object.keys(payload).forEach(
      (k) => typeof payload[k] === "undefined" && delete payload[k]
    );

    try {
      const res = await fetch(
        `https://fitness-app-wdsh.onrender.com/api/trainees/${trainee._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "שגיאה בעדכון נתונים");

      const saved = data.trainee || data.user || data;
      setTrainee(saved);
      setEditData({
        fullName: saved.fullName || "",
        phone: saved.phone || "",
        age: saved.age ?? "",
        height: saved.height ?? "",
        weight: saved.weight ?? "",
        isVegetarian: !!saved.isVegetarian,
        isVegan: !!saved.isVegan,
        glutenSensitive: !!saved.glutenSensitive,
        lactoseSensitive: !!saved.lactoseSensitive,
        dailyCalories: saved.dailyCalories ?? "",
        fatGrams: saved.fatGrams ?? "",
        proteinGrams: saved.proteinGrams ?? "",
        carbGrams: saved.carbGrams ?? "",
      });

      alert("הנתונים עודכנו בהצלחה");
    } catch (err) {
      alert("שגיאה: " + err.message);
    } finally {
      setSaving(false); // ✅ שחרור נעילה
    }
  };

  const openDislikedFoodsModal = async () => {
    try {
      const foodsRes = await fetch(
        "https://fitness-app-wdsh.onrender.com/api/foods",
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      const foods = await foodsRes.json();

      // ✅ נרמול – לא משנה אם השרת מחזיר [] או {items: []}
      const normalized = toArray(foods);
      setAllFoods(normalized);

      setDislikedFoods(
        Array.isArray(trainee.dislikedFoods) ? trainee.dislikedFoods : []
      );
      setShowDislikedFoodsModal(true);
    } catch (err) {
      console.error("openDislikedFoodsModal error:", err);
      alert("שגיאה בטעינת רשימת המזונות");
    }
  };

  const handleToggleFood = (foodId) => {
    setDislikedFoods((prev) =>
      prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId]
    );
  };

  const saveDislikedFoods = async () => {
    try {
      const res = await fetch(
        `https://fitness-app-wdsh.onrender.com/api/trainees/${trainee._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
          body: JSON.stringify({ dislikedFoods }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "שגיאה בשמירת המזונות");

      const saved = data.trainee || data.user || data;
      setTrainee(saved);
      setShowDislikedFoodsModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div dir="rtl">טוען נתונים...</div>;
  if (error) return <div dir="rtl">❗ {error}</div>;

  // ✅ תמיד לעבוד על מערך מנורמל בזמן הרנדר
  const foodsArray = toArray(allFoods);

  return (
    <div className="trainee-dashboard" dir="rtl" style={{ padding: "2rem" }}>
      <h1>ברוכה הבאה, {trainee.fullName}</h1>

      <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: "300px" }}>
          <h2 className="section-title">פרטי מתאמנת</h2>

          <form onSubmit={handleUpdate} className="trainee-form" dir="rtl">
            <div className="form-grid three tight">
              <div className="field">
                <label className="form-label">שם מלא</label>
                <input
                  type="text"
                  name="fullName"
                  value={editData.fullName}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label className="form-label">טלפון נייד</label>
                <input
                  type="text"
                  name="phone"
                  value={editData.phone}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label className="form-label">גיל</label>
                <input
                  type="number"
                  name="age"
                  value={editData.age}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-grid three tight">
              <div className="field">
                <label className="form-label">גובה (ס"מ)</label>
                <input
                  type="number"
                  name="height"
                  value={editData.height}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="field">
                <label className="form-label">משקל (ק"ג)</label>
                <input
                  type="number"
                  name="weight"
                  value={editData.weight}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="checks-grid">
              <label className="check">
                <input
                  type="checkbox"
                  name="isVegetarian"
                  checked={!!editData.isVegetarian}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.checked,
                    }))
                  }
                />
                אני צמחונית
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  name="isVegan"
                  checked={!!editData.isVegan}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.checked,
                    }))
                  }
                />
                אני טבעונית
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  name="glutenSensitive"
                  checked={!!editData.glutenSensitive}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.checked,
                    }))
                  }
                />
                רגישה לגלוטן
              </label>

              <label className="check">
                <input
                  type="checkbox"
                  name="lactoseSensitive"
                  checked={!!editData.lactoseSensitive}
                  onChange={(e) =>
                    setEditData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.checked,
                    }))
                  }
                />
                רגישה ללקטוז
              </label>
            </div>

            {showDislikedFoodsModal && (
              <div className="modal-backdrop">
                <div className="modal" dir="rtl">
                  <div className="modal-header">
                    <h2>בחרי מזונות שלא נאכלים</h2>
                    <button
                      className="close-btn"
                      onClick={() => setShowDislikedFoodsModal(false)}
                    >
                      ←
                    </button>
                  </div>

                  <div className="foods-toolbar">
                    <input
                      type="text"
                      placeholder="חיפוש מזון..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  <div
                    style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
                  >
                    <div style={{ flex: 1, minWidth: "280px" }}>
                      <h4>כל המזונות</h4>
                      <div className="table-wrapper">
                        <table className="history-table narrow">
                          <thead>
                            <tr>
                              <th>בחרי</th>
                              <th>שם מזון</th>
                            </tr>
                          </thead>
                          <tbody>
                            {foodsArray
                              .filter((food) =>
                                (food.name || "")
                                  .toLowerCase()
                                  .includes(searchTerm.toLowerCase())
                              )
                              .map((food) => (
                                <tr key={food._id}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={dislikedFoods.includes(food._id)}
                                      onChange={() =>
                                        handleToggleFood(food._id)
                                      }
                                    />
                                  </td>
                                  <td>{food.name}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: "280px" }}>
                      <div
                        style={{ marginBottom: "12px", textAlign: "center" }}
                      >
                        <button
                          className="action-btn add-btn"
                          onClick={saveDislikedFoods}
                        >
                          שמירה
                        </button>
                      </div>

                      <h4>מזונות שנבחרו</h4>
                      <div className="table-wrapper">
                        <table className="history-table narrow">
                          <thead>
                            <tr>
                              <th>שם מזון</th>
                              <th>הסרה</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dislikedFoods.map((foodId) => {
                              const food = foodsArray.find(
                                (f) => f._id === foodId
                              );
                              return (
                                <tr key={foodId}>
                                  <td>{food?.name || "לא נמצא"}</td>
                                  <td>
                                    <button
                                      className="action-btn delete-btn"
                                      onClick={() =>
                                        setDislikedFoods((prev) =>
                                          prev.filter((f) => f !== foodId)
                                        )
                                      }
                                    >
                                      ❌
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <h3 className="section-title">חישוב מאמן</h3>
            <div className="form-grid four">
              <div className="field">
                <label className="form-label">קלוריות יומיות</label>
                <input type="number" value={editData.dailyCalories} readOnly />
              </div>
              <div className="field">
                <label className="form-label">אחוז שומן</label>
                <input type="number" value={editData.fatGrams} readOnly />
              </div>
              <div className="field">
                <label className="form-label">גרם חלבון</label>
                <input type="number" value={editData.proteinGrams} readOnly />
              </div>
              <div className="field">
                <label className="form-label">גרם פחמימה</label>
                <input type="number" value={editData.carbGrams} readOnly />
              </div>
            </div>

            <button
              type="submit"
              className="btn primary"
              style={{ marginTop: 12 }}
              disabled={saving}
            >
              {saving ? "שומרת..." : "עדכן נתונים"}
            </button>

            <button
              type="button"
              className="action-btn"
              onClick={openDislikedFoodsModal}
              style={{ marginInlineStart: 8 }}
              disabled={saving}
            >
              בחרי מזונות שאת לא אוכלת
            </button>
          </form>

          <hr style={{ margin: "2rem 0" }} />
          <button className="action-btn" onClick={fetchMeasurements}>
            הצג היסטוריית מדידות
          </button>

          {showHistory && (
            <div style={{ marginTop: "20px" }}>
              <h2>היסטוריית מדידות</h2>
              {measurements.length === 0 ? (
                <p>אין מדידות קודמות</p>
              ) : (
                <div className="table-wrapper">
                  <table className="history-table narrow">
                    <thead>
                      <tr>
                        <th>תאריך</th>
                        <th>משקל</th>
                        <th>אחוז שומן</th>
                        <th>מותניים</th>
                        <th>אגן</th>
                        <th>חזה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measurements.map((m, i) => (
                        <tr key={i}>
                          <td>
                            {new Date(m.date).toLocaleDateString("he-IL")}
                          </td>
                          <td>{m.weight}</td>
                          <td>{m.bodyFat}</td>
                          <td>{m.waist}</td>
                          <td>{m.hips}</td>
                          <td>{m.chest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
