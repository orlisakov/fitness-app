// קובץ: src/components/TraineeDetailsForm.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/theme.css";

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
    isVegetarian: false,
    isVegan: false,
    glutenSensitive: false,
    lactoseSensitive: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("לא התקבל מזהה מתאמנת בכתובת");
      return;
    }

    async function fetchTrainee() {
      try {
        const res = await fetch(`http://localhost:5000/api/trainees/${id}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("שגיאה בטעינת פרטי מתאמנת");
        const data = await res.json();

        setFormData((prev) => ({
          ...prev,
          ...data,
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
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`http://localhost:5000/api/trainees/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "שגיאה בעדכון הנתונים");
      }

      const updatedUserData = await res.json();
      console.log("updatedUserData:", updatedUserData);
      localStorage.setItem("user", JSON.stringify(updatedUserData));
      window.location.reload(); // ירענן את האפליקציה עם המשתמש החדש

      alert("הנתונים נשמרו בהצלחה!");
      navigate("/");
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

        <form onSubmit={handleSubmit}>
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
          <label className="checkbox-line">
            <input
              type="checkbox"
              name="isVegetarian"
              checked={formData.isVegetarian}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  isVegetarian: e.target.checked,
                }))
              }
            />
            צמחונית
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              name="isVegan"
              checked={formData.isVegan}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isVegan: e.target.checked }))
              }
            />
            טבעונית
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              name="glutenSensitive"
              checked={formData.glutenSensitive}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  glutenSensitive: e.target.checked,
                }))
              }
            />
            רגישה לגלוטן
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              name="lactoseSensitive"
              checked={formData.lactoseSensitive}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  lactoseSensitive: e.target.checked,
                }))
              }
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
            אחוז שומן:
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

          <button type="submit" className="update-btn">
            שמור
          </button>
        </form>
      </div>
    </div>
  );
}
