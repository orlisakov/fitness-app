// src/components/TraineeDetailsForm.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/theme.css";
import config from "../config";
import { authHeaders } from "../utils/auth";

const MealRow = React.memo(function MealRow({
  mealKey,
  title,
  disabled,
  value,
  onChangeField,
}) {
  return (
    <div className="meal-row">
      <div className="meal-cell">
        <label htmlFor={`${mealKey}-protein`}>
          חלבון <br />
          <span className="meal-unit-sub">(גרם)</span>
        </label>
        <input
          id={`${mealKey}-protein`}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value.protein ?? ""}
          onChange={(e) => onChangeField(mealKey, "protein", e.target.value)}
          disabled={disabled}
          className="meal-input"
          placeholder="0"
        />
      </div>

      <div className="meal-cell">
        <label htmlFor={`${mealKey}-carbs`}>
          פחמימה <br />
          <span className="meal-unit-sub">(גרם)</span>
        </label>
        <input
          id={`${mealKey}-carbs`}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value.carbs ?? ""}
          onChange={(e) => onChangeField(mealKey, "carbs", e.target.value)}
          disabled={disabled}
          className="meal-input"
          placeholder="0"
        />
      </div>

      <div className="meal-cell">
        <label htmlFor={`${mealKey}-fat`}>
          שומן <br />
          <span className="meal-unit-sub">(גרם)</span>
        </label>
        <input
          id={`${mealKey}-fat`}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value.fat ?? ""}
          onChange={(e) => onChangeField(mealKey, "fat", e.target.value)}
          disabled={disabled}
          className="meal-input"
          placeholder="0"
        />
      </div>

      <div className="meal-title">{title}:</div>
    </div>
  );
});

export default function TraineeDetailsForm() {
  const { id } = useParams();

  const navigate = useNavigate();
  const toStr = (v) => (v === 0 || Number.isFinite(Number(v)) ? String(v) : "");

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

  const onChangeMealField = React.useCallback((mealKey, field, newValue) => {
    setFormData((p) => ({
      ...p,
      customMeals: {
        ...p.customMeals,
        [mealKey]: {
          ...p.customMeals[mealKey],
          [field]: newValue,
        },
      },
    }));
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("לא התקבל מזהה מתאמנת בכתובת");
      return;
    }

    async function fetchTrainee() {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/trainees/${id}`, {
          headers: { ...authHeaders(), "Content-Type": "application/json" },
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
      (k) => typeof payload[k] === "undefined" && delete payload[k],
    );

    try {
      const res = await fetch(`${config.apiBaseUrl}/api/trainees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
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

  return (
    <div className="modal-backdrop" dir="rtl">
      <div className="modal">
        <div className="modal-header">
          <h2 className="coach-title">פרטי המתאמנת</h2>
          <button className="close-btn" onClick={() => navigate("/")}>
            ←
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        >
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

          <div className="split-card">
            <div className="split-header">
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
              <p className="muted">
                במצב אוטומטי החלוקה תחושב לפי סה״כ המאקרו/קלוריות שהזנת. כדי
                להזין ידנית, בחרי “מצב ידני”.
              </p>
            )}

            <div className="meal-split">
              <MealRow
                mealKey="breakfast"
                title="בוקר"
                disabled={formData.customSplitMode !== "custom"}
                value={formData.customMeals.breakfast}
                onChangeField={onChangeMealField}
              />

              <MealRow
                mealKey="lunch"
                title="צהריים"
                disabled={formData.customSplitMode !== "custom"}
                value={formData.customMeals.lunch}
                onChangeField={onChangeMealField}
              />

              <MealRow
                mealKey="snack"
                title="ביניים"
                disabled={formData.customSplitMode !== "custom"}
                value={formData.customMeals.snack}
                onChangeField={onChangeMealField}
              />

              <MealRow
                mealKey="dinner"
                title="ערב"
                disabled={formData.customSplitMode !== "custom"}
                value={formData.customMeals.dinner}
                onChangeField={onChangeMealField}
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
