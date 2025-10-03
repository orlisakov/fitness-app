import React from "react";
import { useNavigate, Outlet } from "react-router-dom";
import "../styles/theme.css";
import logo from "../assets/logo.jpg";

export default function DashboardLayout({ onLogout, children, user }) {
  const navigate = useNavigate();

  // נקרא ישירות מה-prop שמגיע מ-App
  const role = user?.role || null;

  return (
    <>
      <header className="dashboard-header">
        <div className="nav-left">
          <img src={logo} alt="לוגו" className="dashboard-logo" />
          <span className="site-title" onClick={() => navigate("/")}>
            Eve's Studio
          </span>
        </div>

        <nav className="nav-links">
          <span onClick={() => navigate("/home-training")}>אימונים ביתיים</span>
          {role === "trainee" ? (
            <span onClick={() => navigate("/personal-menu")}>תפריט אישי</span>
          ) : (
            <span className="placeholder"></span>
          )}
          {role === "coach" ? (
            <span onClick={() => navigate("/Manage-Foods")}>מזונות</span>
          ) : (
            <span className="placeholder"></span>
          )}
          <span className="logout-button" onClick={onLogout}>
            התנתקות
          </span>
        </nav>
      </header>

      <main className="dashboard-main">
        <Outlet />
        {children}
      </main>
    </>
  );
}
