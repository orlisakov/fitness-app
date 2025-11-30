import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/theme.css";
import config from "../config";

export default function DashboardCoach() {
  const navigate = useNavigate();
  const toStr = (v) => (v === 0 || Number.isFinite(Number(v)) ? String(v) : "");

  const joinUrl = (base, p) =>
    `${String(base).replace(/\/$/, "")}/${String(p || "").replace(/^\//, "")}`;

  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showTraineeModal, setShowTraineeModal] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const MAX_PHOTOS = 3;
  const [measurementPhotos, setMeasurementPhotos] = useState([]);
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
    trainingLevel: "beginner",
    customSplitMode: "auto",
    customMeals: {
      breakfast: { protein: "", carbs: "", fat: "" },
      lunch: { protein: "", carbs: "", fat: "" },
      snack: { protein: "", carbs: "", fat: "" },
      dinner: { protein: "", carbs: "", fat: "" },
    },
  });

  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [measurementData, setMeasurementData] = useState({
    date: "",
    AbdominalCircumference: "",
    TopCircumference: "",
    ButtockCircumference: "",
    ThighCircumference: "",
    ArmCircumference: "",
  });

  const [toast, setToast] = useState({
    visible: false,
    text: "",
    type: "success",
  });

  function showToast(text, type = "success", ms = 2500) {
    setToast({ visible: true, text, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => setToast((p) => ({ ...p, visible: false })),
      ms
    );
  }

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [measurements, setMeasurements] = useState([]);

  const [allFoods, setAllFoods] = useState([]);
  const [dislikedFoods, setDislikedFoods] = useState([]);
  const [showDislikedFoodsModal, setShowDislikedFoodsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fillEditDataFromTrainee = (t) => {
    const split = t?.customSplit || { mode: "auto" };
    const meals = split?.meals || {};

    setEditData((prev) => ({
      ...prev,
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
      trainingLevel: t.trainingLevel || "beginner",
      customSplitMode: split.mode || "auto",
      customMeals: {
        breakfast: {
          protein: toStr(meals?.breakfast?.protein),
          carbs: toStr(meals?.breakfast?.carbs),
          fat: toStr(meals?.breakfast?.fat),
        },
        lunch: {
          protein: toStr(meals?.lunch?.protein),
          carbs: toStr(meals?.lunch?.carbs),
          fat: toStr(meals?.lunch?.fat),
        },
        snack: {
          protein: toStr(meals?.snack?.protein),
          carbs: toStr(meals?.snack?.carbs),
          fat: toStr(meals?.snack?.fat),
        },
        dinner: {
          protein: toStr(meals?.dinner?.protein),
          carbs: toStr(meals?.dinner?.carbs),
          fat: toStr(meals?.dinner?.fat),
        },
      },
    }));
  };

  useEffect(() => {
    fetchTrainees();
  }, []);

  function normalizeDate(d) {
    if (!d) return "";
    const [year, month, day] = d.split("-");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  async function fetchTrainees() {
    setLoading(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/trainees`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
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

  const createTrainee = async (e) => {
    e?.preventDefault?.();
    if (!newFullName.trim()) return alert("יש להזין שם מלא");
    if (!newPhone.trim()) return alert("יש להזין טלפון");

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          fullName: newFullName.trim(),
          phone: newPhone.trim(),
          role: "trainee",
          password: "123456",
          customSplit: { mode: "auto" },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "שגיאה ביצירת מתאמנת");

      alert("המתאמנת נוצרה. הסיסמה הראשונית: 123456");
      setShowModal(false);
      setNewFullName("");
      setNewPhone("");

      await fetchTrainees();

      const newId = data?.user?._id || data?.user?.id;
      if (newId) {
        navigate(`/trainees/${newId}`);
      } else {
        console.warn("No new trainee id returned from register", data);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openTraineeModal = (trainee) => {
    setSelectedTrainee(trainee);
    fillEditDataFromTrainee(trainee);
    setShowTraineeModal(true);
  };

  const saveTraineeDetails = async (e) => {
    e?.preventDefault?.();

    if (!selectedTrainee?._id) {
      console.warn("No selectedTrainee or _id – cannot save");
      return;
    }

    let customSplit = undefined;
    if (editData.customSplitMode === "custom") {
      const n = (v) => (v === "" || v == null ? undefined : Number(v));
      customSplit = {
        mode: "custom",
        meals: {
          breakfast: {
            protein: n(editData.customMeals.breakfast.protein),
            carbs: n(editData.customMeals.breakfast.carbs),
            fat: n(editData.customMeals.breakfast.fat),
          },
          lunch: {
            protein: n(editData.customMeals.lunch.protein),
            carbs: n(editData.customMeals.lunch.carbs),
            fat: n(editData.customMeals.lunch.fat),
          },
          snack: {
            protein: n(editData.customMeals.snack.protein),
            carbs: n(editData.customMeals.snack.carbs),
            fat: n(editData.customMeals.snack.fat),
          },
          dinner: {
            protein: n(editData.customMeals.dinner.protein),
            carbs: n(editData.customMeals.dinner.carbs),
            fat: n(editData.customMeals.dinner.fat),
          },
        },
      };
    } else {
      customSplit = { mode: "auto" };
    }

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
      trainingLevel: editData.trainingLevel,
      customSplit,
    };

    Object.keys(payload).forEach(
      (k) => typeof payload[k] === "undefined" && delete payload[k]
    );

    try {
      const res = await fetch(
        `${config.apiBaseUrl}/api/trainees/${selectedTrainee._id}`,
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
      await fetchTrainees();
    } catch (err) {
      console.error("PUT trainee error:", err);
      alert(err.message || "שגיאה בעדכון נתונים");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("האם את בטוחה שברצונך למחוק את המתאמנת?")) return;
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/trainees/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
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
      AbdominalCircumference: "",
      TopCircumference: "",
      ButtockCircumference: "",
      ThighCircumference: "",
      ArmCircumference: "",
    });
    setMeasurementPhotos([]);
    setShowMeasurementsModal(true);
  };

  const handleAddPhoto = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const ok = [];
    for (const f of files) {
      if (!/^image\/(png|jpe?g|webp|gif)$/i.test(f.type)) continue;
      if (f.size > 5 * 1024 * 1024) continue; // עד 5MB
      ok.push(f);
    }
    setMeasurementPhotos((prev) => [...prev, ...ok].slice(0, MAX_PHOTOS));
    e.target.value = ""; // מאפשר בחירה מחדש
  };

  const removePhoto = (idx) => {
    setMeasurementPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const openMeasurementHistory = async (trainee) => {
    setSelectedTrainee(trainee);
    try {
      const res = await fetch(
        `${config.apiBaseUrl}/api/measurements/${trainee._id}`,
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
      const fd = new FormData();
      fd.append("traineeId", selectedTrainee._id);
      fd.append("date", normalizeDate(measurementData.date));

      fd.append(
        "AbdominalCircumference",
        measurementData.AbdominalCircumference || ""
      );
      fd.append("TopCircumference", measurementData.TopCircumference || "");
      fd.append(
        "ButtockCircumference",
        measurementData.ButtockCircumference || ""
      );
      fd.append("ThighCircumference", measurementData.ThighCircumference || "");
      fd.append("ArmCircumference", measurementData.ArmCircumference || "");

      // שולחים מערך 'photos' (וכדאי להשאיר גם 'photo' לתאימות אחורה אם השרת עוד מצפה לשם הזה)
      if (measurementPhotos.length) {
        measurementPhotos.forEach((f) => fd.append("photos", f));
      }

      const res = await fetch(`${config.apiBaseUrl}/api/measurements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          // שימי לב: לא להגדיר כאן Content-Type, הדפדפן יוסיף boundary נכון
        },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בשמירת המדידה");
      }

      showToast("המדידה נשמרה בהצלחה", "success");
      setShowMeasurementsModal(false);
    } catch (err) {
      showToast(err.message || "שגיאה בשמירת המדידה", "error");
    }
  };

  const deleteMeasurement = async (measurementId) => {
    if (!measurementId) return;
    if (!window.confirm("למחוק את המדידה הזו?")) return;
    try {
      const res = await fetch(
        `${config.apiBaseUrl}/api/measurements/${measurementId}`,
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

  const openDislikedFoodsModal = async (trainee) => {
    setSelectedTrainee(trainee);
    try {
      const foodsRes = await fetch(`${config.apiBaseUrl}/api/foods`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
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
        `${config.apiBaseUrl}/api/trainees/${selectedTrainee._id}/disliked-foods`,
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
        throw new Error("שגיאה בשמירת העדפות");
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

  const MealRow = ({ mealKey, title }) => {
    const value = editData.customMeals[mealKey];
    const disabled = editData.customSplitMode !== "custom";

    const onNumericChange = (field) => (e) => {
      const cleaned = (e.target.value || "").replace(/\D/g, "").slice(0, 20);

      setEditData((p) => ({
        ...p,
        customMeals: {
          ...p.customMeals,
          [mealKey]: { ...p.customMeals[mealKey], [field]: cleaned },
        },
      }));
    };

    return (
      <div className="meal-row">
        <div className="meal-cell">
          <label htmlFor={`${mealKey}-protein`}>
            חלבון
            <br />
            <span className="meal-unit-sub">(גרם)</span>
          </label>
          <input
            id={`${mealKey}-protein`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value.protein ?? ""}
            onChange={onNumericChange("protein")}
            disabled={disabled}
            className="meal-input"
            placeholder="0"
          />
        </div>

        <div className="meal-cell">
          <label htmlFor={`${mealKey}-carbs`}>
            פחמימה
            <br />
            <span className="meal-unit-sub">(גרם)</span>
          </label>
          <input
            id={`${mealKey}-carbs`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value.carbs ?? ""}
            onChange={onNumericChange("carbs")}
            disabled={disabled}
            className="meal-input"
            placeholder="0"
          />
        </div>

        <div className="meal-cell">
          <label htmlFor={`${mealKey}-fat`}>
            שומן
            <br />
            <span className="meal-unit-sub">(גרם)</span>
          </label>
          <input
            id={`${mealKey}-fat`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={value.fat ?? ""}
            onChange={onNumericChange("fat")}
            disabled={disabled}
            className="meal-input"
            placeholder="0"
          />
        </div>

        <div className="meal-title">{title}:</div>
      </div>
    );
  };

  return (
    <div className="coach-dashboard" dir="rtl">
      <h1 className="coach-title">לוח הבקרה של המאמנת</h1>

      <button className="add-btn" onClick={() => setShowModal(true)}>
        הוספת מתאמנת חדשה
      </button>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal add-trainee-modal" dir="rtl">
            <div className="modal-header">
              <h2>הוספת מתאמנת חדשה</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ←
              </button>
            </div>

            <form onSubmit={createTrainee}>
              <div className="form-row compact">
                <div className="field">
                  <label className="form-label">שם מלא</label>
                  <input
                    className="text-input input-sm"
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label className="form-label">טלפון</label>
                  <input
                    className="text-input input-sm"
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn primary"
                style={{ marginTop: 12 }}
              >
                יצירה
              </button>
            </form>
          </div>
        </div>
      )}

      {trainees.length === 0 ? (
        <p className="dashboard-message">אין מתאמנות במערכת כרגע</p>
      ) : (
        <div className="table-wrapper coach-table-wrapper">
          <table className="history-table coach-table">
            <thead>
              <tr>
                <th>שם מלא</th>
                <th>טלפון</th>
                <th>פעולות</th>
                <th>היסטוריית שקילויות</th>
                <th>דרגה</th>
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
                      עריכה
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => handleDelete(t._id)}
                    >
                      מחק
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => openMeasurementModal(t)}
                    >
                      מדידה
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => openDislikedFoodsModal(t)}
                    >
                      העדפות
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
                  <td>
                    {t.trainingLevel === "advanced"
                      ? "מתקדמות"
                      : t.trainingLevel === "intermediate"
                      ? "בינוניות"
                      : "מתחילות"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

              <h3 className="section-title">דרגת אימון</h3>
              <div className="form-grid one">
                <div className="field">
                  <label className="form-label">בחרי דרגה:</label>
                  <select
                    value={editData.trainingLevel}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        trainingLevel: e.target.value,
                      }))
                    }
                  >
                    <option value="beginner">מתחילות</option>
                    <option value="intermediate">בינוניות</option>
                    <option value="advanced">מתקדמות</option>
                  </select>
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

              {/* -------- חלוקת מאקרו לארוחות -------- */}
              <h3 className="section-title">חלוקת מאקרו לארוחות</h3>

              <div className="split-card">
                <div className="split-header">
                  <label className="check">
                    <input
                      type="radio"
                      name="splitMode"
                      checked={editData.customSplitMode === "auto"}
                      onChange={() =>
                        setEditData((p) => ({ ...p, customSplitMode: "auto" }))
                      }
                    />
                    מצב אוטומטי (אלגוריתם)
                  </label>

                  <label className="check">
                    <input
                      type="radio"
                      name="splitMode"
                      checked={editData.customSplitMode === "custom"}
                      onChange={() =>
                        setEditData((p) => ({
                          ...p,
                          customSplitMode: "custom",
                        }))
                      }
                    />
                    מצב ידני (גרמים לכל ארוחה)
                  </label>
                </div>

                {editData.customSplitMode === "auto" && (
                  <p className="muted">
                    במצב אוטומטי החלוקה תחושב לפי סה״כ המאקרו/קלוריות שהוזנו.
                    כדי להזין ידנית בחרי “מצב ידני”.
                  </p>
                )}

                <div className="meal-split">
                  <MealRow mealKey="breakfast" title="בוקר" />
                  <MealRow mealKey="lunch" title="צהריים" />
                  <MealRow mealKey="snack" title="ביניים" />
                  <MealRow mealKey="dinner" title="ערב" />
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

      {toast.visible && (
        <div className={`toast ${toast.type}`} dir="rtl">
          {toast.text}
        </div>
      )}

      {/* מודאלים נוספים (מדידות, היסטוריה, מזונות) נשארו */}
      {showMeasurementsModal && (
        <div className="modal-backdrop">
          <div className="modal measurements-modal" dir="rtl">
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
                placeholder="היקף בטן (טבור)"
                value={measurementData.AbdominalCircumference}
                onChange={(e) =>
                  setMeasurementData((p) => ({
                    ...p,
                    AbdominalCircumference: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder="היקף עליון"
                value={measurementData.TopCircumference}
                onChange={(e) =>
                  setMeasurementData((p) => ({
                    ...p,
                    TopCircumference: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder="היקף ישבן"
                value={measurementData.ButtockCircumference}
                onChange={(e) =>
                  setMeasurementData((p) => ({
                    ...p,
                    ButtockCircumference: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder="היקף ירכיים"
                value={measurementData.ThighCircumference}
                onChange={(e) =>
                  setMeasurementData((p) => ({
                    ...p,
                    ThighCircumference: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder="היקף זרוע"
                value={measurementData.ArmCircumference}
                onChange={(e) =>
                  setMeasurementData((p) => ({
                    ...p,
                    ArmCircumference: e.target.value,
                  }))
                }
              />
              {/* תיבת העלאת תמונות – עד 3 */}
              <div className="upload-tiles">
                {measurementPhotos.map((file, i) => (
                  <div key={i} className="upload-tile upload-preview">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`preview-${i}`}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid var(--pink,#fd2767)",
                      }}
                    />
                    <button
                      type="button"
                      className="remove-x"
                      onClick={() => removePhoto(i)}
                      aria-label="הסרת תמונה"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {Array.from({
                  length: MAX_PHOTOS - measurementPhotos.length,
                }).map((_, i) => (
                  <label key={`slot-${i}`} className="upload-tile">
                    <span className="small">הוספת תמונה</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="upload-input"
                      onChange={handleAddPhoto}
                    />
                    <div className="upload-cta">בחרי קובץ</div>
                  </label>
                ))}
              </div>

              <button type="submit" className="update-btn">
                שמור מדידה
              </button>
            </form>
          </div>
        </div>
      )}

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
              <div className="table-wrapper">
                <table className="history-table narrow">
                  <thead>
                    <tr>
                      <th>תאריך</th>
                      <th>בטן/טבור (ס״מ)</th>
                      <th>חזה/עליון (ס״מ)</th>
                      <th>ישבן/אגן (ס״מ)</th>
                      <th>ירך (ס״מ)</th>
                      <th>זרוע (ס״מ)</th>
                      <th>תמונות</th>
                      <th>הסר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((m, index) => (
                      <tr key={index}>
                        <td>{new Date(m.date).toLocaleDateString("he-IL")}</td>
                        <td>{m.AbdominalCircumference}</td>
                        <td>{m.TopCircumference}</td>
                        <td>{m.ButtockCircumference}</td>
                        <td>{m.ThighCircumference}</td>
                        <td>{m.ArmCircumference}</td>
                        <td>
                          {(() => {
                            const imgs =
                              Array.isArray(m.imagePaths) && m.imagePaths.length
                                ? m.imagePaths
                                : m.imagePath
                                ? [m.imagePath]
                                : [];
                            return imgs.length ? (
                              <div style={{ display: "flex", gap: 6 }}>
                                {imgs.slice(0, 3).map((p, idx) => (
                                  <img
                                    key={idx}
                                    src={joinUrl(config.apiBaseUrl, p)}
                                    alt="מדידה"
                                    style={{
                                      width: 56,
                                      height: 56,
                                      objectFit: "cover",
                                      borderRadius: 8,
                                      border: "1px solid var(--pink, #fd2767)",
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              "—"
                            );
                          })()}
                        </td>

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
              </div>
            )}
          </div>
        </div>
      )}

      {showDislikedFoodsModal && (
        <div className="modal-backdrop">
          <div className="modal" dir="rtl">
            <div className="modal-header">
              <h2>בחרי העדפות - {selectedTrainee?.fullName}</h2>
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
                      {allFoods
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
                        const food = allFoods.find((f) => f._id === foodId);
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
