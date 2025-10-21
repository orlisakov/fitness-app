// src/components/TraineeDetailsForm.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/theme.css";
import config from "../config";

export default function TraineeDetailsForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    age: "",
    height: "",
    weight: "",
    fatGrams: "",
    dailyCalories: "",
    proteinGrams: "",
    carbGrams: "",
    trainingLevel: "beginner",
    isVegetarian: false,
    isVegan: false,
    glutenSensitive: false,
    lactoseSensitive: false,

    // חלוקת מאקרו לארוחות
    customSplitMode: "auto",
    customMeals: {
      breakfast: { protein: "", carbs: "", fat: "" },
      lunch: { protein: "", carbs: "", fat: "" },
      snack: { protein: "", carbs: "", fat: "" },
      dinner: { protein: "", carbs: "", fat: "" },
    },
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- Inline styles (כדי להבטיח שינוי מיידי) ----
  const styles = {
    splitCard: {
      border: "1px solid #e7e7e7",
      borderRadius: 12,
      padding: 14,
      margin: "12px 0 18px",
      background: "#fff",
    },
    splitHeader: {
      display: "flex",
      gap: 18,
      alignItems: "center",
      flexWrap: "wrap",
      marginBottom: 10,
      fontWeight: 600,
    },
    muted: {
      margin: "0 0 12px 0",
      color: "#6b7280",
      fontSize: "0.95rem",
    },
    mealSplit: {
      display: "grid",
      gap: 12,
    },
    // שלוש תיבות + כותרת ארוחה בקצה הימני
    mealRow: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(110px, 220px)) 120px",
      gap: 10,
      alignItems: "center",
    },
    mealTitle: {
      fontWeight: 700,
      color: "#374151",
      textAlign: "right",
    },
    mealCell: {
      display: "grid",
      gridTemplateColumns: "1fr 100px",
      alignItems: "center",
      gap: 8,
      fontSize: "0.95rem",
      color: "#374151",
    },
    mealInput: {
      height: 36,
      padding: "0 10px",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      fontSize: "0.95rem",
      background: "#fff",
      boxSizing: "border-box",
    },
    unitWrap: {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1.1,
    },
    unitSub: {
      fontSize: "0.8rem",
      color: "#6b7280",
    },
  };

  useEffect(() => {
    if (!id) {
      setError("לא התקבל מזהה מתאמנת בכתובת");
      return;
    }

    async function fetchTrainee() {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/trainees/${id}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("שגיאה בטעינת פרטי מתאמנת");
        const data = await res.json();

        const split = data?.customSplit || { mode: "auto" };
        const meals = split?.meals || {};

        setFormData((prev) => ({
          ...prev,
          ...data,
          customSplitMode: split.mode || "auto",
          customMeals: {
            breakfast: {
              protein: meals?.breakfast?.protein ?? "",
              carbs: meals?.breakfast?.carbs ?? "",
              fat: meals?.breakfast?.fat ?? "",
            },
            lunch: {
              protein: meals?.lunch?.protein ?? "",
              carbs: meals?.lunch?.carbs ?? "",
              fat: meals?.lunch?.fat ?? "",
            },
            snack: {
              protein: meals?.snack?.protein ?? "",
              carbs: meals?.snack?.carbs ?? "",
              fat: meals?.snack?.fat ?? "",
            },
            dinner: {
              protein: meals?.dinner?.protein ?? "",
              carbs: meals?.dinner?.carbs ?? "",
              fat: meals?.dinner?.fat ?? "",
            },
          },
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchTrainee();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const n = (v) => (v === "" || v == null ? undefined : Number(v));

  const handleSubmit = async (e) => {
    e.preventDefault();

    let customSplit =
      formData.customSplitMode === "custom"
        ? {
            mode: "custom",
            meals: {
              breakfast: {
                protein: n(formData.customMeals.breakfast.protein),
                carbs: n(formData.customMeals.breakfast.carbs),
                fat: n(formData.customMeals.breakfast.fat),
              },
              lunch: {
                protein: n(formData.customMeals.lunch.protein),
                carbs: n(formData.customMeals.lunch.carbs),
                fat: n(formData.customMeals.lunch.fat),
              },
              snack: {
                protein: n(formData.customMeals.snack.protein),
                carbs: n(formData.customMeals.snack.carbs),
                fat: n(formData.customMeals.snack.fat),
              },
              dinner: {
                protein: n(formData.customMeals.dinner.protein),
                carbs: n(formData.customMeals.dinner.carbs),
                fat: n(formData.customMeals.dinner.fat),
              },
            },
          }
        : { mode: "auto" };

    const payload = {
      age: n(formData.age),
      height: n(formData.height),
      weight: n(formData.weight),
      fatGrams: n(formData.fatGrams),
      dailyCalories: n(formData.dailyCalories),
      proteinGrams: n(formData.proteinGrams),
      carbGrams: n(formData.carbGrams),
      trainingLevel: formData.trainingLevel,
      isVegetarian: !!formData.isVegetarian,
      isVegan: !!formData.isVegan,
      glutenSensitive: !!formData.glutenSensitive,
      lactoseSensitive: !!formData.lactoseSensitive,
      customSplit,
    };

    Object.keys(payload).forEach(
      (k) => typeof payload[k] === "undefined" && delete payload[k]
    );

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/trainees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בעדכון הנתונים");
      }

      const updatedUserData = await res.json();
      localStorage.setItem("user", JSON.stringify(updatedUserData));
      alert("הנתונים נשמרו בהצלחה!");
      navigate("/");
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div>טוען נתונים...</div>;
  if (error) return <div className="error">{error}</div>;

  // ——— שורה קומפקטית לכל ארוחה ———
  const MealRow = ({ mealKey, title, disabled }) => {
    const value = formData.customMeals[mealKey];

    // קלט טקסטי שמקבל רק ספרות
    const numericChange = (field) => (e) => {
      const cleaned = e.target.value.replace(/\D/g, ""); // רק ספרות
      setFormData((p) => ({
        ...p,
        customMeals: {
          ...p.customMeals,
          [mealKey]: { ...p.customMeals[mealKey], [field]: cleaned },
        },
      }));
    };

    const Unit = ({ titleText }) => (
      <div style={styles.unitWrap}>
        <div>{titleText}</div>
        <div style={styles.unitSub}>(גרם)</div>
      </div>
    );

    return (
      <div className="meal-row" style={styles.mealRow}>
        <label className="meal-cell" style={styles.mealCell}>
          <Unit titleText="חלבון" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.protein ?? ""}
            onChange={numericChange("protein")}
            disabled={disabled}
            className="meal-input"
            style={styles.mealInput}
            placeholder="0"
          />
        </label>

        <label className="meal-cell" style={styles.mealCell}>
          <Unit titleText="פחמימה" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.carbs ?? ""}
            onChange={numericChange("carbs")}
            disabled={disabled}
            className="meal-input"
            style={styles.mealInput}
            placeholder="0"
          />
        </label>

        <label className="meal-cell" style={styles.mealCell}>
          <Unit titleText="שומן" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.fat ?? ""}
            onChange={numericChange("fat")}
            disabled={disabled}
            className="meal-input"
            style={styles.mealInput}
            placeholder="0"
          />
        </label>

        <div className="meal-title" style={styles.mealTitle}>
          {title}:
        </div>
      </div>
    );
  };

  return (
    <div className="modal-backdrop" dir="rtl">
      <div className="modal">
        <div className="modal-header">
          <h2 className="coach-title">פרטי המתאמנת</h2>
          <button className="close-btn" onClick={() => navigate("/")}>
            ←
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ——— נתונים כלליים ——— */}
          <label>
            גיל:
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
            />
          </label>

          <label>
            גובה (ס"מ):
            <input
              type="number"
              name="height"
              value={formData.height}
              onChange={handleChange}
            />
          </label>

          <label>
            משקל (ק"ג):
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
            />
          </label>

          <label>
            דרגת אימון:
            <select
              name="trainingLevel"
              value={formData.trainingLevel}
              onChange={handleChange}
            >
              <option value="beginner">מתחילות</option>
              <option value="intermediate">בינוניות</option>
              <option value="advanced">מתקדמות</option>
            </select>
          </label>

          <label className="checkbox-line">
            <input
              type="checkbox"
              name="isVegetarian"
              checked={formData.isVegetarian}
              onChange={handleChange}
            />
            צמחונית
          </label>

          <label className="checkbox-line">
            <input
              type="checkbox"
              name="isVegan"
              checked={formData.isVegan}
              onChange={handleChange}
            />
            טבעונית
          </label>

          <label className="checkbox-line">
            <input
              type="checkbox"
              name="glutenSensitive"
              checked={formData.glutenSensitive}
              onChange={handleChange}
            />
            רגישה לגלוטן
          </label>

          <label className="checkbox-line">
            <input
              type="checkbox"
              name="lactoseSensitive"
              checked={formData.lactoseSensitive}
              onChange={handleChange}
            />
            רגישה ללקטוז
          </label>

          <h3>חישוב מאמנת</h3>

          <label>
            כמות קלוריות יומית:
            <input
              type="number"
              name="dailyCalories"
              value={formData.dailyCalories}
              onChange={handleChange}
            />
          </label>

          <label>
            אחוז שומן / גרם שומן:
            <input
              type="number"
              name="fatGrams"
              value={formData.fatGrams}
              onChange={handleChange}
            />
          </label>

          <label>
            גרם חלבון:
            <input
              type="number"
              name="proteinGrams"
              value={formData.proteinGrams}
              onChange={handleChange}
            />
          </label>

          <label>
            גרם פחמימה:
            <input
              type="number"
              name="carbGrams"
              value={formData.carbGrams}
              onChange={handleChange}
            />
          </label>

          {/* ——— חלוקת מאקרו לארוחות ——— */}
          <h3>חלוקת מאקרו לארוחות</h3>

          <div className="split-card" style={styles.splitCard}>
            <div className="split-header" style={styles.splitHeader}>
              <label className="check">
                <input
                  type="radio"
                  name="splitMode"
                  checked={formData.customSplitMode === "auto"}
                  onChange={() =>
                    setFormData((p) => ({ ...p, customSplitMode: "auto" }))
                  }
                />
                מצב אוטומטי (אלגוריתם)
              </label>

              <label className="check">
                <input
                  type="radio"
                  name="splitMode"
                  checked={formData.customSplitMode === "custom"}
                  onChange={() =>
                    setFormData((p) => ({ ...p, customSplitMode: "custom" }))
                  }
                />
                מצב ידני (גרמים לכל ארוחה)
              </label>
            </div>

            {formData.customSplitMode === "auto" && (
              <p className="muted" style={styles.muted}>
                במצב אוטומטי החלוקה תחושב לפי סה״כ המאקרו/קלוריות שהזנת. כדי
                להזין ידנית, בחרי “מצב ידני”.
              </p>
            )}

            <div className="meal-split" style={styles.mealSplit}>
              <MealRow
                mealKey="breakfast"
                title="בוקר"
                disabled={formData.customSplitMode !== "custom"}
              />
              <MealRow
                mealKey="lunch"
                title="צהריים"
                disabled={formData.customSplitMode !== "custom"}
              />
              <MealRow
                mealKey="snack"
                title="ביניים"
                disabled={formData.customSplitMode !== "custom"}
              />
              <MealRow
                mealKey="dinner"
                title="ערב"
                disabled={formData.customSplitMode !== "custom"}
              />
            </div>
          </div>

          <button type="submit" className="update-btn">
            שמור
          </button>
        </form>
      </div>
    </div>
  );
}
