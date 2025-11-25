// src/pages/ManageFoods.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import "../styles/theme.css";
import Select from "react-select";
import config from "../config";

const FLAG_TO_SAFE_CAT = {
  isVegan: "safe_vegan",
  isVegetarian: "safe_vegetarian",
  isGlutenFree: "safe_gluten_free",
  isLactoseFree: "safe_lactose_free",
};

function syncFlagsToCategories(payload) {
  const set = new Set(payload.categories || []);
  for (const [flag, cat] of Object.entries(FLAG_TO_SAFE_CAT)) {
    if (payload.dietaryFlags?.[flag]) set.add(cat);
    else set.delete(cat);
  }
  return { ...payload, categories: Array.from(set) };
}

/** Utilities */
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const dietaryFlagsList = [
  { label: "טבעוני", value: "isVegan" },
  { label: "צמחוני", value: "isVegetarian" },
  { label: "ללא גלוטן", value: "isGlutenFree" },
  { label: "ללא לקטוז", value: "isLactoseFree" },
];

/** מיפוי להצגה בטבלה (לא קשור להצגה ללקוח) */
const categoryMap = {
  // --- בוקר ---
  protein_breakfast: "חלבון לבוקר",
  carbs_breakfast: "פחמימות לבוקר",
  fat_breakfast: "שומנים לבוקר",
  vegetables_breakfast: "ירקות חופשיים לבוקר",

  // --- צהריים ---
  veges_Protein: "חלבון לצמחונים",
  protein_lunch: "חלבון לצהריים",
  carbs_lunch: "פחמימות לצהריים (כללי)",
  fat_lunch: "שומנים לצהריים",
  vegetables_lunch: "ירקות חופשיים לצהריים",
  legumes_lunch: "קטניות לצהריים",

  // --- ביניים ---
  protein_snack: "חלבון לביניים",
  carbs_snack: "פחמימות לביניים",
  fat_snack: "שומנים לביניים",
  sweet_snack: "מתוקים/חטיפים",
  fruit_snack: "פירות",

  // --- ערב ---
  protein_dinner: "חלבון לערב",
  carbs_dinner: "פחמימות לערב (כללי)",
  fat_dinner: "שומנים לערב",
  vegetables_dinner: "ירקות חופשיים לערב",

  // --- תתי-קטגוריות ---
  carbs_bread: "לחמים/טורטיות/קרקרים",
  carbs_pita: "פיתות",
  carbs_grain: "דגנים מבושלים",
  carbs_root: "שורשיים",

  // === דגלים ספציפיים לדגים/טונה (ללוגיקת המיונז) ===
  fish_in_water: "דג/טונה במים", // ← חדש
  fish_in_oil: "דג/טונה בשמן", // ← חדש

  vegetables_limited_onion: "ירק מוגבל – בצל",
  vegetables_limited_carrot: "ירק מוגבל – גזר",
  vegetables_limited_eggplant: "ירק מוגבל – חציל",
  vegetables_limited_light_corn: "ירק מוגבל – תירס לייט",
  fat_avocado: "אבוקדו (מוגבל)",

  // --- דגלי התאמה/רגישות (תיאוריים בלבד פה) ---
  flag_meat: "דגל: מכיל בשר/עוף",
  flag_fish: "דגל: מכיל דגים/ים",
  flag_egg: "דגל: מכיל ביצים",
  flag_dairy: "דגל: מוצר חלב",
  flag_lactose: "דגל: מכיל לקטוז",
  flag_gluten: "דגל: מכיל גלוטן",

  // (אופציונלי – לתיוג פנימי) — לא יוצג ללקוח בתפריט
  safe_gluten_free: "✓ ללא גלוטן",
  safe_lactose_free: "✓ ללא לקטוז",
  safe_vegan: "✓ טבעוני",
  safe_vegetarian: "✓ צמחוני",
};

const allCategoriesOptions = Object.entries(categoryMap).map(
  ([value, label]) => ({
    value,
    label,
  })
);

export default function ManageFoods() {
  const [foods, setFoods] = useState([]);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editFood, setEditFood] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchFoods = useCallback(async () => {
    try {
      const query = searchTerm ? `?name=${encodeURIComponent(searchTerm)}` : "";
      const res = await fetch(`${config.apiBaseUrl}/api/foods${query}`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "שגיאה בטעינת מאכלים");
      }
      const data = await res.json();
      setFoods(Array.isArray(data) ? data : data.items || []);
      setError("");
    } catch (err) {
      setError(err.message || "שגיאה בטעינת מאכלים");
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const handleDelete = async (id) => {
    if (!window.confirm("את/ה בטוח/ה שברצונך למחוק?")) return;
    const res = await fetch(`${config.apiBaseUrl}/api/foods/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.message || "שגיאה במחיקה");
      return;
    }
    fetchFoods();
  };

  const handleAddFood = async (food) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/foods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(food),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בהוספת מאכל");
      }

      await fetchFoods();
      setShowAddModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateFood = async (food) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/foods/${food._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(food),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "שגיאה בעדכון מאכל");
      }

      await fetchFoods();
      setEditFood(null);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div dir="rtl" style={{ padding: "2rem" }}>
      <h1 className="page-title">ניהול מאכלים</h1>

      <div
        className="foods-toolbar"
        dir="rtl"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="toolbar-right" style={{ display: "flex", gap: 8 }}>
          <input
            className="search-input"
            type="text"
            placeholder="חיפוש לפי שם..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn search-btn" onClick={fetchFoods}>
            חפש 🔍
          </button>
        </div>
        <div className="toolbar-left">
          <button className="btn add-btn" onClick={() => setShowAddModal(true)}>
            ➕ הוספת מאכל חדש
          </button>
        </div>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="table-wrapper" style={{ overflowX: "auto" }}>
        <table className="history-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>שם</th>
              <th>קל׳</th>
              <th>חלבון</th>
              <th>פחמ'</th>
              <th>שומן</th>
              <th>יחידת בסיס</th>
              <th>קטגוריות</th>
              <th>אפשרויות</th>
            </tr>
          </thead>
          <tbody>
            {foods.map((food) => (
              <tr key={food._id}>
                <td>{food.name}</td>
                <td>{food.calories}</td>
                <td>{food.protein}</td>
                <td>{food.carbs}</td>
                <td>{food.fat}</td>
                <td>{food?.servingInfo?.displayName || "—"}</td>
                <td>
                  {(food.categories || []).map((cat, i) => (
                    <div key={i}>{categoryMap[cat] || cat}</div>
                  ))}
                </td>
                <td
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  <button onClick={() => setEditFood(food)}>ערוך</button>
                  <button onClick={() => handleDelete(food._id)}>מחק</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <FoodModal
          title="הוספת מאכל"
          onClose={() => setShowAddModal(false)}
          onSave={handleAddFood}
        />
      )}
      {editFood && (
        <FoodModal
          title="עריכת מאכל"
          food={editFood}
          onClose={() => setEditFood(null)}
          onSave={handleUpdateFood}
        />
      )}
    </div>
  );
}

/** —— Modal —— */
function FoodModal({ title, onClose, onSave, food = {} }) {
  const [form, setForm] = useState(() => ({
    _id: food._id,
    name: food.name || "",
    calories: food.calories ?? 0,
    protein: food.protein ?? 0,
    fat: food.fat ?? 0,
    carbs: food.carbs ?? 0,
    categories: food.categories || [],
    servingInfo: {
      baseUnit: food?.servingInfo?.baseUnit || "gram",
      baseQuantity: food?.servingInfo?.baseQuantity ?? 100,
      displayName: food?.servingInfo?.displayName || "100 גרם",
      commonServings: food?.servingInfo?.commonServings || [],
    },
    constraints: {
      minServing: food?.constraints?.minServing ?? 0.5,
      maxServing: food?.constraints?.maxServing ?? 5,
      increment: food?.constraints?.increment ?? 0.5,
    },
    mealSuitability: {
      breakfast: food?.mealSuitability?.breakfast ?? 5,
      lunch: food?.mealSuitability?.lunch ?? 5,
      dinner: food?.mealSuitability?.dinner ?? 5,
      snack: food?.mealSuitability?.snack ?? 5,
    },
    dietaryFlags: {
      isVegan: !!food?.dietaryFlags?.isVegan,
      isVegetarian: !!food?.dietaryFlags?.isVegetarian,
      isGlutenFree: !!food?.dietaryFlags?.isGlutenFree,
      isLactoseFree: !!food?.dietaryFlags?.isLactoseFree,
      isKeto: !!food?.dietaryFlags?.isKeto,
      isLowCarb: !!food?.dietaryFlags?.isLowCarb,
    },
    cost: food.cost ?? 3,
    availability: food.availability ?? 4,
    isActive: food.isActive ?? true,
  }));

  // react-select value
  const selectedCategories = useMemo(
    () =>
      allCategoriesOptions.filter((opt) => form.categories.includes(opt.value)),
    [form.categories]
  );

  const setNested = (path, value) => {
    setForm((prev) => {
      const obj = structuredClone(prev);
      let p = obj;
      for (let i = 0; i < path.length - 1; i++) p = p[path[i]];
      p[path[path.length - 1]] = value;
      return obj;
    });
  };

  const addCommonServing = () => {
    const next = [...(form.servingInfo.commonServings || [])];
    next.push({ name: "", quantity: 1, displayText: "" });
    setNested(["servingInfo", "commonServings"], next);
  };
  const updateCommonServing = (idx, key, val) => {
    const next = [...(form.servingInfo.commonServings || [])];
    if (!next[idx]) return;
    next[idx] = {
      ...next[idx],
      [key]: key === "quantity" ? toNumber(val, 1) : val,
    };
    setNested(["servingInfo", "commonServings"], next);
  };
  const removeCommonServing = (idx) => {
    const next = [...(form.servingInfo.commonServings || [])];
    next.splice(idx, 1);
    setNested(["servingInfo", "commonServings"], next);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = syncFlagsToCategories({
      ...form,
      // ודא מספרים:
      calories: toNumber(form.calories),
      protein: toNumber(form.protein),
      fat: toNumber(form.fat),
      carbs: toNumber(form.carbs),
      cost: toNumber(form.cost, 3),
      availability: toNumber(form.availability, 4),
      servingInfo: {
        ...form.servingInfo,
        baseQuantity: toNumber(form.servingInfo.baseQuantity, 100),
        commonServings: (form.servingInfo.commonServings || []).map((s) => ({
          name: s.name || "",
          quantity: toNumber(s.quantity, 1),
          displayText: s.displayText || "",
        })),
      },
      constraints: {
        minServing: toNumber(form.constraints.minServing, 0.5),
        maxServing: toNumber(form.constraints.maxServing, 5),
        increment: toNumber(form.constraints.increment, 0.5),
      },
      mealSuitability: {
        breakfast: toNumber(form.mealSuitability.breakfast, 5),
        lunch: toNumber(form.mealSuitability.lunch, 5),
        dinner: toNumber(form.mealSuitability.dinner, 5),
        snack: toNumber(form.mealSuitability.snack, 5),
      },
      dietaryFlags: { ...form.dietaryFlags },
    });
    onSave(payload);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>
            ✖
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="form-content"
          style={{ display: "grid", gap: 12 }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <label>
              שם מאכל:
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </label>
            <label>
              פעיל?
              <select
                className="text-input"
                value={form.isActive ? "1" : "0"}
                onChange={(e) =>
                  setForm((p) => ({ ...p, isActive: e.target.value === "1" }))
                }
              >
                <option value="1">כן</option>
                <option value="0">לא</option>
              </select>
            </label>

            <label>
              קלוריות:
              <input
                type="number"
                value={form.calories}
                onChange={(e) =>
                  setForm((p) => ({ ...p, calories: e.target.value }))
                }
                required
              />
            </label>
            <label>
              חלבון:
              <input
                type="number"
                value={form.protein}
                onChange={(e) =>
                  setForm((p) => ({ ...p, protein: e.target.value }))
                }
                required
              />
            </label>
            <label>
              פחמימה:
              <input
                type="number"
                value={form.carbs}
                onChange={(e) =>
                  setForm((p) => ({ ...p, carbs: e.target.value }))
                }
                required
              />
            </label>
            <label>
              שומן:
              <input
                type="number"
                value={form.fat}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fat: e.target.value }))
                }
                required
              />
            </label>

            <label>
              עלות (1-5):
              <input
                type="number"
                min={1}
                max={5}
                value={form.cost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, cost: e.target.value }))
                }
              />
            </label>
            <label>
              זמינות (1-5):
              <input
                type="number"
                min={1}
                max={5}
                value={form.availability}
                onChange={(e) =>
                  setForm((p) => ({ ...p, availability: e.target.value }))
                }
              />
            </label>
          </div>

          <label>
            קטגוריות:
            <Select
              isMulti
              options={allCategoriesOptions}
              value={selectedCategories}
              onChange={(selected) =>
                setForm((prev) => ({
                  ...prev,
                  categories: (selected || []).map((o) => o.value),
                }))
              }
              placeholder="בחר קטגוריות..."
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </label>

          <fieldset
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
          >
            <legend>מידע הגשה (servingInfo)</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
              }}
            >
              <label>
                יחידת בסיס:
                <select
                  className="text-input"
                  value={form.servingInfo.baseUnit}
                  onChange={(e) =>
                    setNested(["servingInfo", "baseUnit"], e.target.value)
                  }
                >
                  <option value="gram">גרם</option>
                  <option value="piece">יחידה</option>
                  <option value="cup">כוס</option>
                  <option value="tablespoon">כף</option>
                  <option value="ml">מ״ל</option>
                </select>
              </label>
              <label>
                כמות בסיס:
                <input
                  type="number"
                  value={form.servingInfo.baseQuantity}
                  onChange={(e) =>
                    setNested(["servingInfo", "baseQuantity"], e.target.value)
                  }
                />
              </label>
              <label>
                שם תצוגה:
                <input
                  type="text"
                  value={form.servingInfo.displayName}
                  onChange={(e) =>
                    setNested(["servingInfo", "displayName"], e.target.value)
                  }
                />
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong>הגשות נפוצות</strong>
                <button type="button" onClick={addCommonServing}>
                  + הוספה
                </button>
              </div>
              {(form.servingInfo.commonServings || []).map((cs, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 3fr auto",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <input
                    placeholder="שם (למשל: חצי קוטג')"
                    value={cs.name}
                    onChange={(e) =>
                      updateCommonServing(idx, "name", e.target.value)
                    }
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="כמות יחסית (1=בסיס)"
                    value={cs.quantity}
                    onChange={(e) =>
                      updateCommonServing(idx, "quantity", e.target.value)
                    }
                  />
                  <input />
                  placeholder="טקסט תצוגה (למשל: \"125 גרם (חצי קוטג')\")"
                  value={cs.displayText}
                  onChange=
                  {(e) =>
                    updateCommonServing(idx, "displayText", e.target.value)
                  }
                  <button
                    type="button"
                    onClick={() => removeCommonServing(idx)}
                  >
                    מחק
                  </button>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
          >
            <legend>אילוצי הגשה (constraints)</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              <label>
                מינימום:
                <input
                  type="number"
                  step="0.1"
                  value={form.constraints.minServing}
                  onChange={(e) =>
                    setNested(["constraints", "minServing"], e.target.value)
                  }
                />
              </label>
              <label>
                מקסימום:
                <input
                  type="number"
                  step="0.1"
                  value={form.constraints.maxServing}
                  onChange={(e) =>
                    setNested(["constraints", "maxServing"], e.target.value)
                  }
                />
              </label>
              <label>
                צעד (לא חובה):
                <input
                  type="number"
                  step="0.1"
                  value={form.constraints.increment}
                  onChange={(e) =>
                    setNested(["constraints", "increment"], e.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
          >
            <legend>התאמה לארוחות (0–10)</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              <label>
                בוקר:
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.mealSuitability.breakfast}
                  onChange={(e) =>
                    setNested(["mealSuitability", "breakfast"], e.target.value)
                  }
                />
              </label>
              <label>
                צהריים:
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.mealSuitability.lunch}
                  onChange={(e) =>
                    setNested(["mealSuitability", "lunch"], e.target.value)
                  }
                />
              </label>
              <label>
                ערב:
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.mealSuitability.dinner}
                  onChange={(e) =>
                    setNested(["mealSuitability", "dinner"], e.target.value)
                  }
                />
              </label>
              <label>
                ביניים:
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.mealSuitability.snack}
                  onChange={(e) =>
                    setNested(["mealSuitability", "snack"], e.target.value)
                  }
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}
          >
            <legend>דגלי תזונה (dietaryFlags)</legend>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {dietaryFlagsList.map((f) => (
                <label
                  key={f.value}
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={!!form.dietaryFlags[f.value]}
                    onChange={(e) =>
                      setNested(["dietaryFlags", f.value], e.target.checked)
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <button type="button" onClick={onClose}>
              ביטול
            </button>
            <button type="submit">💾 שמור</button>
          </div>
        </form>
      </div>
    </div>
  );
}
