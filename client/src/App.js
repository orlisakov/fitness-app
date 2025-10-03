// קובץ: src/App.js
import React, { useState, useEffect } from "react";
import TraineeDetailsForm from "./components/TraineeDetailsForm";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DashboardCoach from "./pages/DashboardCoach";
import DashboardTrainee from "./pages/DashboardTrainee";
import Login from "./Login";
import Register from "./Register";
import DashboardLayout from "./components/DashboardLayout";
import HomeTraining from "./pages/HomeTraining";
import PersonalMenu from "./pages/PersonalMenu";
import ManageFoods from "./pages/ManageFoods";

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // אם יש טוקן ב-sessionStorage (שורד רענון, לא שורד סגירת טאב/דפדפן)
    const token = sessionStorage.getItem("token");
    if (!token) {
      setUser(null);
      return; // לא מחוברות => יופנה ל /login ע"י ה-Routes
    }
    // נטען את המשתמש המחובר מהשרת
    fetch("https://fitness-app-wdsh.onrender.com/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((me) => setUser(me))
      .catch(() => setUser(null));
  }, []);

  const handleLogin = (data) => {
    // נשמור טוקן ל-sessionStorage בלבד כדי שיימחק בסגירת טאב/דפדפן
    sessionStorage.setItem("token", data.token);
    setUser(data.user);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    // אם שמרת בעבר user ב-localStorage – מחיקה הגנתית:
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
    window.location.reload(); // ריענון כדי לנקות
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Register onRegister={handleLogin} />
          )
        }
      />
      <Route path="/trainee/:id" element={<TraineeDetailsForm />} />

      <Route
        path="/"
        element={<DashboardLayout onLogout={handleLogout} user={user} />}
      >
        <Route
          index
          element={
            user ? (
              user.role === "coach" ? (
                <DashboardCoach user={user} />
              ) : (
                <DashboardTrainee user={user} />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="home-training" element={<HomeTraining />} />

        <Route
          path="personal-menu"
          element={
            user && user.role === "trainee" ? (
              <PersonalMenu traineeData={user} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="Manage-Foods" element={<ManageFoods />} />
      </Route>
    </Routes>
  );
}
