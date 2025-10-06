// src/App.js (גרסה עם userLoading + RequireRole מתוקן)
import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import DashboardLayout from "./components/DashboardLayout";
import DashboardCoach from "./pages/DashboardCoach";
import DashboardTrainee from "./pages/DashboardTrainee";
import CoachWorkouts from "./pages/CoachWorkouts";
import TraineeWorkouts from "./pages/TraineeWorkouts";
import PersonalMenu from "./pages/PersonalMenu";
import ManageFoods from "./pages/ManageFoods";
import TraineeDetailsForm from "./components/TraineeDetailsForm";
import Login from "./Login";
import Register from "./Register";
import config from "./config";

export default function App() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      setUser(null);
      setUserLoading(false);
      return;
    }
    fetch(`${config.apiBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((me) => setUser(me.user || me))
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  const handleLogin = (data) => {
    sessionStorage.setItem("token", data.token);
    setUser(data.user || null);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
    window.location.reload();
  };

  // Guard לפי תפקיד, עם טיפול בטעינה
  const RequireRole = ({ allow, element }) => {
    if (userLoading) return <div dir="rtl">טוען…</div>;
    return user && allow.includes(user.role) ? (
      element
    ) : (
      <Navigate to="/" replace />
    );
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
            userLoading ? (
              <div dir="rtl">טוען…</div>
            ) : user ? (
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

        {/* מתאמנת */}
        <Route
          path="workouts"
          element={
            <RequireRole allow={["trainee"]} element={<TraineeWorkouts />} />
          }
        />
        <Route
          path="personal-menu"
          element={
            <RequireRole
              allow={["trainee"]}
              element={<PersonalMenu traineeData={user} />}
            />
          }
        />

        {/* מאמנת */}
        <Route
          path="coach-workouts"
          element={
            <RequireRole allow={["coach"]} element={<CoachWorkouts />} />
          }
        />
        <Route
          path="manage-foods"
          element={<RequireRole allow={["coach"]} element={<ManageFoods />} />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
