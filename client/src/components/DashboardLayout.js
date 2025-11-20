// src/components/DashboardLayout.jsx
import React, { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import "../styles/theme.css";
import logo from "../assets/logo.jpg";

export default function DashboardLayout({ onLogout, user }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = user?.role || null;

  const TRAINEE_WORKOUTS_PATH = "/workouts";
  const COACH_WORKOUTS_PATH = "/coach-workouts";
  const MANAGE_FOODS_PATH = "/manage-foods";
  const PERSONAL_MENU_PATH = "/personal-menu";
  const TRAINEE_HOME_PATH = "/trainee-home";

  const linkCls = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  function onLogoClick() {
    if (role === "trainee") {
      navigate(TRAINEE_HOME_PATH);
    } else {
      navigate("/");
    }
    setMenuOpen(false);
  }

  function handleNavClick() {
    // בנייד – כשנלחץ לינק, נסגור את התפריט
    setMenuOpen(false);
  }

  return (
    <>
      <header className="dashboard-header" dir="rtl">
        <div className="dashboard-header-inner">
          <div className="nav-left">
            <img
              src={logo}
              alt="לוגו"
              className="dashboard-logo"
              style={{ cursor: "pointer" }}
              onClick={onLogoClick}
            />

            <button
              type="button"
              className="site-title"
              onClick={onLogoClick}
              aria-label="חזרה לדשבורד"
            >
              Eiv's Studio
            </button>

            {/* כפתור תפריט – מוצג רק בנייד (CSS) */}
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="פתיחת תפריט"
            >
              ☰
            </button>
          </div>

          <nav className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
            {role === "trainee" && (
              <NavLink
                to="/trainee-dashboard"
                className={linkCls}
                onClick={handleNavClick}
              >
                פרטים אישיים
              </NavLink>
            )}

            {role === "coach" ? (
              <NavLink
                to={COACH_WORKOUTS_PATH}
                className={linkCls}
                onClick={handleNavClick}
              >
                תכניות אימון שלי
              </NavLink>
            ) : (
              <NavLink
                to={TRAINEE_WORKOUTS_PATH}
                className={linkCls}
                onClick={handleNavClick}
              >
                אימונים ביתיים
              </NavLink>
            )}

            {role === "trainee" && (
              <NavLink
                to={PERSONAL_MENU_PATH}
                className={linkCls}
                onClick={handleNavClick}
              >
                תפריט אישי
              </NavLink>
            )}

            {role === "coach" && (
              <NavLink
                to={MANAGE_FOODS_PATH}
                className={linkCls}
                onClick={handleNavClick}
              >
                ניהול מאגר
              </NavLink>
            )}

            {role === "coach" && (
              <NavLink
                to="/resources-manage"
                className={linkCls}
                onClick={handleNavClick}
              >
                קבצים להעלאה
              </NavLink>
            )}

            <NavLink
              to="/resources"
              className={linkCls}
              onClick={handleNavClick}
            >
              קבצים להורדה
            </NavLink>

            <button type="button" className="logout-button" onClick={onLogout}>
              התנתקות
            </button>
          </nav>
        </div>
      </header>

      <main className="dashboard-main" dir="rtl">
        <Outlet />
      </main>
    </>
  );
}
