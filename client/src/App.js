// src/App.jsx
import React, { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import ResourcesLibrary from "./pages/ResourcesLibrary";
import ResourcesManage from "./pages/ResourcesManage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardCoach from "./pages/DashboardCoach";
import DashboardTrainee from "./pages/DashboardTrainee";
import CoachWorkouts from "./pages/CoachWorkouts";
import TraineeWorkouts from "./pages/TraineeWorkouts";
import ManageFoods from "./pages/ManageFoods";
import TraineeDetailsForm from "./components/TraineeDetailsForm";
import Login from "./Login";
import Register from "./Register";
import config from "./config";

// ✅ LAZY (בלי import רגיל שלהם!)
const PersonalMenu = lazy(() => import("./pages/PersonalMenu"));
const TraineeHomePage = lazy(() => import("./pages/TraineeHomePage"));

export default function App() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const navigate = useNavigate();
  console.log("API BASE:", config.apiBaseUrl);

  useEffect(() => {
    const token =
      sessionStorage.getItem("token") || localStorage.getItem("token");
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
    // חשוב: לשמור token נקי
    const cleanToken = String(data.token || "").replace(/^Bearer\s+/i, "");
    sessionStorage.setItem("token", cleanToken);
    localStorage.setItem("token", cleanToken);
    setUser(data.user || null);
  };

  const handleLogout = () => {
    // מוחקים הכול
    sessionStorage.removeItem("token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // חשוב: מעדכנים state כדי שכל האפליקציה תדע שיצאת
    setUser(null);
    setUserLoading(false);

    // ניווט ללוגין
    navigate("/login", { replace: true });
  };

  // ✅ רכיב ביניים למניעת גישה לפי תפקיד
  const RequireRole = ({ allow, element }) => {
    if (userLoading) return <div dir="rtl">טוען…</div>;
    return user && allow.includes(user.role) ? (
      element
    ) : (
      <Navigate to="/" replace />
    );
  };

  // ✅ עטיפה ל-Lazy routes (כדי שיהיה "טוען…" ולא מסך לבן)
  const LazyWrap = ({ children }) => (
    <Suspense fallback={<div dir="rtl">טוען…</div>}>{children}</Suspense>
  );

  return (
    <Routes>
      {/* דפים ציבוריים */}
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

      {/* דפי משתמש ספציפיים */}
      <Route
        path="trainees/:id"
        element={
          <RequireRole allow={["coach"]} element={<TraineeDetailsForm />} />
        }
      />

      {/* דשבורד ראשי */}
      <Route
        path="/"
        element={<DashboardLayout onLogout={handleLogout} user={user} />}
      >
        {/* Index route */}
        <Route
          index
          element={
            userLoading ? (
              <div dir="rtl">טוען…</div>
            ) : user ? (
              user.role === "coach" ? (
                <DashboardCoach user={user} />
              ) : (
                <Navigate to="/trainee-home" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* דף הבית של המתאמנת (Lazy) */}
        <Route
          path="trainee-home"
          element={
            <RequireRole
              allow={["trainee"]}
              element={
                <LazyWrap>
                  <TraineeHomePage user={user} />
                </LazyWrap>
              }
            />
          }
        />

        {/* דשבורד המתאמנת */}
        <Route
          path="trainee-dashboard"
          element={
            <RequireRole allow={["trainee"]} element={<DashboardTrainee />} />
          }
        />

        {/* אימונים */}
        <Route
          path="workouts"
          element={
            <RequireRole allow={["trainee"]} element={<TraineeWorkouts />} />
          }
        />
        <Route
          path="coach-workouts"
          element={
            <RequireRole allow={["coach"]} element={<CoachWorkouts />} />
          }
        />

        {/* תפריט אישי (Lazy) */}
        <Route
          path="personal-menu"
          element={
            <RequireRole
              allow={["trainee"]}
              element={
                <LazyWrap>
                  <PersonalMenu traineeData={user} />
                </LazyWrap>
              }
            />
          }
        />

        {/* ניהול מזונות */}
        <Route
          path="manage-foods"
          element={<RequireRole allow={["coach"]} element={<ManageFoods />} />}
        />

        {/* ניהול קבצים */}
        <Route
          path="resources-manage"
          element={
            <RequireRole allow={["coach"]} element={<ResourcesManage />} />
          }
        />
        <Route
          path="resources"
          element={
            <RequireRole
              allow={["trainee", "coach"]}
              element={<ResourcesLibrary />}
            />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>

      {/* Fallback גלובלי */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
