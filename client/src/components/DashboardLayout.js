// src/components/DashboardLayout.jsx
import React from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import "../styles/theme.css";
import logo from "../assets/logo.jpg";

export default function DashboardLayout({ onLogout, user }) {
  const navigate = useNavigate();
  const role = user?.role || null;

  // התאימי לראוטים שהוגדרו ב-App.js
  // אם הראוט אצלך הוא "/trainee-workouts" — החליפי כאן.
  const TRAINEE_WORKOUTS_PATH = "/workouts";
  const COACH_WORKOUTS_PATH = "/coach-workouts";
  const MANAGE_FOODS_PATH = "/manage-foods";
  const PERSONAL_MENU_PATH = "/personal-menu";

  const linkCls = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <>
      <header className="dashboard-header" dir="rtl">
        <div className="nav-left">
          <img src={logo} alt="לוגו" className="dashboard-logo" />
          <button
            type="button"
            className="site-title-btn"
            onClick={() => navigate("/")}
            aria-label="חזרה לדשבורד"
          >
            Eiv's Studio
          </button>
        </div>

        <nav className="nav-links">
          {/* קישור לאימונים – לפי תפקיד */}
          {role === "coach" ? (
            <NavLink to={COACH_WORKOUTS_PATH} className={linkCls}>
              תכניות אימון שלי
            </NavLink>
          ) : (
            <NavLink to={TRAINEE_WORKOUTS_PATH} className={linkCls}>
              אימונים ביתיים
            </NavLink>
          )}

          {/* תפריט אישי למתאמנת בלבד */}
          {role === "trainee" && (
            <NavLink to={PERSONAL_MENU_PATH} className={linkCls}>
              תפריט אישי
            </NavLink>
          )}

          {/* ניהול מזונות למאמנת בלבד */}
          {role === "coach" && (
            <NavLink to={MANAGE_FOODS_PATH} className={linkCls}>
              ניהול מאגר
            </NavLink>
          )}

          {/* אופציונלי: למאמנת כפתור נוסף לניהול */}
          {role === "coach" && (
            <NavLink to="/resources-manage" className={linkCls}>
              קבצים להעלאה
            </NavLink>
          )}
          <NavLink to="/resources" className={linkCls}>
            קבצים להורדה
          </NavLink>

          {/* התנתקות */}
          <button type="button" className="logout-button" onClick={onLogout}>
            התנתקות
          </button>
        </nav>
      </header>

      <main className="dashboard-main" dir="rtl">
        <Outlet />
      </main>
    </>
  );
}
