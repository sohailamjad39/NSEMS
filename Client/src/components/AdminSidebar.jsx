/**
 * Client/src/components/AdminSidebar.jsx
 *
 * Shared sidebar component for all admin pages.
 * Uses the same ad- CSS namespace.
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { removeToken } from "../services/auth";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/admin-dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "All Students",
    path: "/admin/students",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Register Student",
    path: "/register-student",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    label: "Scan Logs",
    path: "/admin/scan-logs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: "Manage Admins",
    path: "/admin/admins",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
];

const AdminSidebar = ({ sidebarOpen, setSidebarOpen, onCleanup }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const adminName = localStorage.getItem("adminName") || "Administrator";
  const adminRole = localStorage.getItem("role") || "admin";

  const handleLogout = () => {
    if (onCleanup) onCleanup();
    removeToken();
    navigate("/");
  };

  const handleNav = (path) => {
    setSidebarOpen(false);
    navigate(path);
  };

  const SidebarContent = () => (
    <>
      <div className="ad-sidebar-brand">
        <img
          src="/NUTECH_logo.png"
          alt="NUTECH"
          className="ad-sidebar-logo"
          onError={(e) => { e.target.style.display = "none"; }}
        />
        <div className="ad-sidebar-brand-text">
          <span className="ad-sidebar-brand-title">Admin Panel</span>
          <span className="ad-sidebar-brand-sub">NSEMS v1.0</span>
        </div>
      </div>

      <div className="ad-sidebar-profile">
        <div className="ad-sidebar-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
        <div>
          <p className="ad-sidebar-profile-name">{adminName}</p>
          <p className="ad-sidebar-profile-role" style={{ textTransform: "capitalize" }}>{adminRole}</p>
        </div>
      </div>

      <nav className="ad-sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`ad-nav-item${location.pathname === item.path ? " ad-nav-item--active" : ""}`}
            onClick={() => handleNav(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button className="ad-nav-item ad-nav-item--logout" onClick={handleLogout}
        style={{ margin: "0 0.65rem 0.5rem", borderRadius: 9, border: "none", display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0.75rem", background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", width: "calc(100% - 1.3rem)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Logout</span>
      </button>

      <span className="ad-sidebar-version">v 1.0 — NSEMS</span>
    </>
  );

  return (
    <>
      {/* Backdrop */}
      {sidebarOpen && (
        <div className="ad-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      {/* Desktop sidebar */}
      <aside className="ad-sidebar ad-sidebar--desktop">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside className={`ad-sidebar ad-sidebar--mobile${sidebarOpen ? " ad-sidebar--open" : ""}`}>
        <button className="ad-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <SidebarContent />
      </aside>
    </>
  );
};

export default AdminSidebar;