// client/src/pages/DashboardCoach.jsx
import React, { useEffect, useState } from "react";
import "../styles/theme.css";

export default function DashboardCoach() {
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // יצירת מתאמנת חדשה
  const [showModal, setShowModal] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // "פרטי מתאמנת" (מודאל הצג)
  const [showTraineeModal, setShowTraineeModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [editData, setEditData] = useState({
    fullName: "",
    phone: "",
    age: "",
    height: "",
    weight: "",
    isVegetarian: false,
    isVegan: false,
    glutenSensitive: false,
    lactoseSensitive: false,
    dailyCalories: "",
    fatGrams: "",
    proteinGrams: "",
    carbGrams: "",
  });

  // מדידות
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [measurementData, setMeasurementData] = useState({
    date: "",
    weight: "",
    bodyFat: "",
    waist: "",
    hips: "",
    chest: "",
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [measurements, setMeasurements] = useState([]);

  // מזונות לא נאכלים
  const [allFoods, setAllFoods] = useState([]);
  const [dislikedFoods, setDislikedFoods] = useState([]);
  const [showDislikedFoodsModal, setShowDislikedFoodsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ======== עזר ========
  const fillEditDataFromTrainee = (t) => {
    setEditData({
      fullName: t.fullName || "",
      phone: t.phone || "",
      age: t.age ?? "",
      height: t.height ?? "",
      weight: t.weight ?? "",
      isVegetarian: !!t.isVegetarian,
      isVegan: !!t.isVegan,
      glutenSensitive: !!t.glutenSensitive,
      lactoseSensitive: !!t.lactoseSensitive,
      dailyCalories: t.dailyCalories ?? "",
      fatGrams: t.fatGrams ?? "",
      proteinGrams: t.proteinGrams ?? "",
      carbGrams: t.carbGrams ?? "",
    });
  };

  useEffect(() => {
    fetchTrainees();
  }, []);

  async function fetchTrainees() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/trainees", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("לא ניתן לטעון את רשימת המתאמנות");
      const data = await res.json();
      setTrainees(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "שגיאה בטעינת מתאמנות");
    } finally {
      setLoading(false);
    }
  }

  // ======== פרטי מתאמנת (מודאל "הצג") ========
  const openTraineeModal = (trainee) => {
    setSelectedTrainee(trainee);
    fillEditDataFromTrainee(trainee);
    setShowTraineeModal(true);
  };

  const saveTraineeDetails = async (e) => {
    e.preventDefault();
    if (!selectedTrainee?._id) return;

    const payload = {
      fullName: editData.fullName,
      phone: editData.phone,
      age: editData.age === "" ? undefined : Number(editData.age),
      height: editData.height === "" ? undefined : Number(editData.height),
      weight: editData.weight === "" ? undefined : Number(editData.weight),
      isVegetarian: !!editData.isVegetarian,
      isVegan: !!editData.isVegan,
      glutenSensitive: !!editData.glutenSensitive,
      lactoseSensitive: !!editData.lactoseSensitive,
      dailyCalories:
        editData.dailyCalories === ""
          ? undefined
          : Number(editData.dailyCalories),
      fatGrams:
        editData.fatGrams === "" ? undefined : Number(editData.fatGrams),
      proteinGrams:
        editData.proteinGrams === ""
          ? undefined
          : Number(editData.proteinGrams),
      carbGrams:
        editData.carbGrams === "" ? undefined : Number(editData.carbGrams),
    };

    Object.keys(payload).forEach(
      (k) => typeof payload[k] === "undefined" && delete payload[k]
    );

    try {
      const res = await fetch(
        `http://localhost:5000/api/trainees/${selectedTrainee._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "שגיאה בעדכון נתונים");

      const saved = data.trainee || data.user || data;
      setTrainees((prev) => prev.map((t) => (t._id === saved._id ? saved : t)));
      setSelectedTrainee(saved);
      setShowTraineeModal(false);

      // ריענון הרשימה לקבלת מצב עדכני מהשרת
      fetchTrainees();
    } catch (err) {
      alert(err.message || "שגיאה בעדכון נתונים");
    }
  };

  // ======== פעולות נוספות ========
  const handleDelete = async (id) => {
    if (!window.confirm("האם את בטוחה שברצונך למחוק את המתאמנת?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/trainees/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("שגיאה במחיקה");
      setTrainees((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      alert(err.message || "שגיאה במחיקה");
    }
  };

  const openMeasurementModal = (trainee) => {
    setSelectedTrainee(trainee);
    setMeasurementData({
      date: "",
      weight: "",
      bodyFat: "",
      waist: "",
      hips: "",
      chest: "",
    });
    setShowMeasurementsModal(true);
  };

  const openMeasurementHistory = async (trainee) => {
    setSelectedTrainee(trainee);
    try {
      const res = await fetch(
        `http://localhost:5000/api/measurements/${trainee._id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) throw new Error("שגיאה בשליפת ההיסטוריה");
      const data = await res.json();
      setMeasurements(Array.isArray(data) ? data : []);
      setShowHistoryModal(true);
    } catch (err) {
      alert(err.message || "שגיאה בשליפת ההיסטוריה");
    }
  };

  const handleMeasurementSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          ...measurementData,
          traineeId: selectedTrainee._id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בשמירת המדידה");
      }
      alert("המדידה נשמרה בהצלחה");
      setShowMeasurementsModal(false);
    } catch (err) {
      alert(err.message || "שגיאה בשמירת המדידה");
    }
  };

  const deleteMeasurement = async (measurementId) => {
    if (!measurementId) return;
    if (!window.confirm("למחוק את המדידה הזו?")) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/measurements/${measurementId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "שגיאה במחיקת המדידה");
      }
      setMeasurements((prev) => prev.filter((m) => m._id !== measurementId));
    } catch (err) {
      alert(err.message || "שגיאה במחיקה");
    }
  };

  const handleAddTrainee = async (e) => {
    e.preventDefault();
    const newTrainee = {
      fullName: newFullName,
      phone: newPhone,
      password: "123456",
      role: "trainee",
      isVegetarian: false,
      isVegan: false,
      glutenSensitive: false,
      lactoseSensitive: false,
    };
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(newTrainee),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "שגיאה ביצירת מתאמנת");

      const created = data.user || data.trainee || data;

      // נסגור מודאל ההוספה ונפתח את מודאל "הצג" עם אותה תצוגה
      setShowModal(false);
      setNewFullName("");
      setNewPhone("");

      setSelectedTrainee(created);
      fillEditDataFromTrainee(created);
      setShowTraineeModal(true);

      // נרענן את הטבלה כדי שכבר תופיע
      fetchTrainees();
    } catch (err) {
      alert(err.message || "שגיאה ביצירת מתאמנת");
    }
  };

  const openDislikedFoodsModal = async (trainee) => {
    setSelectedTrainee(trainee);
    try {
      const foodsRes = await fetch("http://localhost:5000/api/foods", {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      if (!foodsRes.ok) {
        const txt = await foodsRes.text();
        console.error("foods fetch failed:", txt);
        alert("שגיאה בטעינת מזונות");
        return;
      }
      const data = await foodsRes.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setAllFoods(list);
      setDislikedFoods(
        Array.isArray(trainee.dislikedFoods) ? trainee.dislikedFoods : []
      );
      setShowDislikedFoodsModal(true);
    } catch (err) {
      console.error(err);
      alert("שגיאה בטעינת מזונות");
    }
  };

  const saveDislikedFoods = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/trainees/${selectedTrainee._id}/disliked-foods`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
          body: JSON.stringify({ dislikedFoods }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error("Server returned:", text);
        throw new Error("שגיאה בשמירת המזונות שלא נאכלים");
      }
      setTrainees((prev) =>
        prev.map((t) =>
          t._id === selectedTrainee._id ? { ...t, dislikedFoods } : t
        )
      );
      setShowDislikedFoodsModal(false);
    } catch (err) {
      alert(err.message || "שגיאה בשמירת מזונות");
    }
  };

  if (loading) return <div className="dashboard-message">טוען נתונים...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;

  const allFoodsArr = Array.isArray(allFoods) ? allFoods : [];

  return (
    <div className="coach-dashboard" dir="rtl">
      <h1 className="coach-title">לוח הבקרה של המאמנת</h1>

      <button className="add-btn" onClick={() => setShowModal(true)}>
        הוספת מתאמנת חדשה
      </button>

      {trainees.length === 0 ? (
        <p className="dashboard-message">אין מתאמנות במערכת כרגע</p>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>שם מלא</th>
              <th>טלפון</th>
              <th>פעולות</th>
              <th>היסטוריית שקילויות</th>
            </tr>
          </thead>
          <tbody>
            {trainees.map((t) => (
              <tr key={t._id}>
                <td>{t.fullName}</td>
                <td>{t.phone || "-"}</td>
                <td>
                  <button
                    className="action-btn"
                    onClick={() => openTraineeModal(t)}
                  >
                    הצג
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleDelete(t._id)}
                  >
                    מחק
                  </button>
                  <button
                    className="action-btn add-btn"
                    onClick={() => openMeasurementModal(t)}
                  >
                    מדידה
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => openDislikedFoodsModal(t)}
                  >
                    מזונות לא נאכלים
                  </button>
                </td>
                <td>
                  <button
                    className="action-btn"
                    onClick={() => openMeasurementHistory(t)}
                  >
                    ראה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* מודאל – יצירת מתאמנת חדשה */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>הוספת מתאמנת חדשה</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ←
              </button>
            </div>
            <form onSubmit={handleAddTrainee}>
              <input
                type="text"
                placeholder="שם מלא"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="טלפון"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
              />
              <p>סיסמה תיווצר אוטומטית: 123456</p>
              <button type="submit">צור והמשך</button>
            </form>
          </div>
        </div>
      )}

      {/* מודאל – פרטי מתאמנת */}
      {showTraineeModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>פרטי מתאמנת — {selectedTrainee?.fullName}</h2>
              <button
                className="close-btn"
                onClick={() => setShowTraineeModal(false)}
              >
                ←
              </button>
            </div>

            <form onSubmit={saveTraineeDetails} className="trainee-form">
              <h3 className="section-title">פרטי המתאמנת</h3>

              <div className="form-grid three tight">
                <div className="field">
                  <label className="form-label">שם מלא</label>
                  <input
                    type="text"
                    value={editData.fullName}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, fullName: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label className="form-label">טלפון נייד</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="form-grid three tight">
                <div className="field">
                  <label className="form-label">גיל:</label>
                  <input
                    type="number"
                    value={editData.age}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, age: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label className="form-label">גובה (ס״מ):</label>
                  <input
                    type="number"
                    value={editData.height}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, height: e.target.value }))
                    }
                  />
                </div>

                <div className="field">
                  <label className="form-label">משקל (ק״ג):</label>
                  <input
                    type="number"
                    value={editData.weight}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, weight: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="checks-grid">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!editData.isVegetarian}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        isVegetarian: e.target.checked,
                      }))
                    }
                  />
                  צמחונית
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!editData.isVegan}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, isVegan: e.target.checked }))
                    }
                  />
                  טבעונית
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!editData.glutenSensitive}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        glutenSensitive: e.target.checked,
                      }))
                    }
                  />
                  רגישה לגלוטן
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!editData.lactoseSensitive}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        lactoseSensitive: e.target.checked,
                      }))
                    }
                  />
                  רגישה ללקטוז
                </label>
              </div>

              <h3 className="section-title">חישוב מאמנת</h3>
              <div className="form-grid four">
                <div className="field">
                  <label className="form-label">כמות קלוריות יומית:</label>
                  <input
                    type="number"
                    value={editData.dailyCalories}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        dailyCalories: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="form-label">אחוז/גרם שומן:</label>
                  <input
                    type="number"
                    value={editData.fatGrams}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, fatGrams: e.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="form-label">גרם חלבון:</label>
                  <input
                    type="number"
                    value={editData.proteinGrams}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        proteinGrams: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label className="form-label">גרם פחמימה:</label>
                  <input
                    type="number"
                    value={editData.carbGrams}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, carbGrams: e.target.value }))
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn primary"
                style={{ marginTop: 12 }}
              >
                שמור
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודאל – מדידה */}
      {showMeasurementsModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>הוספת מדידות עבור {selectedTrainee?.fullName}</h2>
              <button
                className="close-btn"
                onClick={() => setShowMeasurementsModal(false)}
              >
                ←
              </button>
            </div>
            <form onSubmit={handleMeasurementSubmit}>
              <input
                type="date"
                value={measurementData.date}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
              <input
                type="number"
                placeholder='משקל (ק"ג)'
                value={measurementData.weight}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, weight: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="אחוז שומן"
                value={measurementData.bodyFat}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, bodyFat: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder='מותניים (ס"מ)'
                value={measurementData.waist}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, waist: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder='אגן (ס"מ)'
                value={measurementData.hips}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, hips: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder='חזה (ס"מ)'
                value={measurementData.chest}
                onChange={(e) =>
                  setMeasurementData((p) => ({ ...p, chest: e.target.value }))
                }
              />
              <button type="submit" className="update-btn">
                שמור מדידה
              </button>
            </form>
          </div>
        </div>
      )}

      {/* מודאל – היסטוריית מדידות */}
      {showHistoryModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>היסטוריית מדידות - {selectedTrainee?.fullName}</h2>
              <button
                className="close-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                ←
              </button>
            </div>
            {measurements.length === 0 ? (
              <p>אין מדידות קודמות</p>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>משקל (ק"ג)</th>
                    <th>אחוז שומן (%)</th>
                    <th>מותניים (ס"מ)</th>
                    <th>אגן (ס"מ)</th>
                    <th>חזה (ס"מ)</th>
                    <th>הסר</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((m, index) => (
                    <tr key={index}>
                      <td>{new Date(m.date).toLocaleDateString("he-IL")}</td>
                      <td>{m.weight}</td>
                      <td>{m.bodyFat}</td>
                      <td>{m.waist}</td>
                      <td>{m.hips}</td>
                      <td>{m.chest}</td>
                      <td>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => deleteMeasurement(m._id)}
                          disabled={!m._id}
                        >
                          הסר
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* מודאל – מזונות לא נאכלים */}
      {showDislikedFoodsModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>בחרי מזונות שלא נאכלים - {selectedTrainee?.fullName}</h2>
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

            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
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
                      {allFoodsArr
                        .filter((food) =>
                          (food?.name || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
                        )
                        .map((food) => (
                          <tr key={food._id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={dislikedFoods.includes(food._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDislikedFoods((prev) => [
                                      ...prev,
                                      food._id,
                                    ]);
                                  } else {
                                    setDislikedFoods((prev) =>
                                      prev.filter((f) => f !== food._id)
                                    );
                                  }
                                }}
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
                <div style={{ marginBottom: "12px", textAlign: "center" }}>
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
                        const food = allFoodsArr.find((f) => f._id === foodId);
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
    </div>
  );
}
