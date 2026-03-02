/**
 * Client/src/pages/Login.jsx
 *
 * Login page – fixed error handling & offline-service isolation
 * UI updated to match design image – pure CSS, no Tailwind/MUI
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE from "../config/api";
import { setToken } from "../services/auth";
import { offlineService } from "../services/offlineService";

const Login = () => {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    console.log("✅ Login component mounted");
    console.log("   API_BASE:", API_BASE);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // ─── 1. NETWORK REQUEST ────────────────────────────────────────
    let response;
    try {
      response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password }),
      });
    } catch (networkErr) {
      console.error("❌ Network error:", networkErr);
      setError(
        "Cannot reach the server. Please check your connection and make sure the server is running."
      );
      setIsLoading(false);
      return;
    }

    // ─── 2. PARSE RESPONSE ─────────────────────────────────────────
    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error("❌ Failed to parse server response:", parseErr);
      setError("Unexpected server response. Please try again.");
      setIsLoading(false);
      return;
    }

    // ─── 3. CHECK FOR HTTP ERRORS ──────────────────────────────────
    if (!response.ok) {
      console.warn("⚠️ Server responded with status", response.status, data);
      setError(data.message || `Login failed (status ${response.status})`);
      setIsLoading(false);
      return;
    }

    // ─── 4. CHECK APPLICATION-LEVEL SUCCESS ────────────────────────
    if (!data.success && !data.token) {
      setError(data.message || "Invalid credentials");
      setIsLoading(false);
      return;
    }

    // ─── 5. STORE AUTH TOKEN ───────────────────────────────────────
    try {
      setToken(data.token);
    } catch (tokenErr) {
      console.error("❌ Failed to store token:", tokenErr);
      setError("Failed to save authentication. Please try again.");
      setIsLoading(false);
      return;
    }

    // ─── 6. STORE USER DATA ───────────────────────────────────────
    try {
      if (data.role === "student") {
        localStorage.setItem("role", "student");
        localStorage.setItem("studentId", data.studentId || "");
        localStorage.setItem("studentName", data.name || "");
        localStorage.setItem("studentImage", data.imageLink || "");
        if (data.secretKey) {
          localStorage.setItem("studentSecretKey", data.secretKey);
        }
      } else if (data.role === "admin" || data.role === "scanner") {
        localStorage.setItem("role", data.role);
        localStorage.setItem("adminName", data.name || "");
      }
    } catch (storageErr) {
      console.error("❌ localStorage error:", storageErr);
      // Non-fatal – continue to navigation
    }

    // ─── 7. OFFLINE CACHE (non-blocking, non-fatal) ───────────────
    try {
      if (data.role === "student") {
        await offlineService.storeLoginData(data);
        await offlineService.storeStudentData({
          studentId: data.studentId,
          name: data.name,
          secretKey: data.secretKey,
          program: data.program || "Software Engineering",
          department: data.department || "Computer Science",
          year: data.year || 3,
          status: data.status || "active",
        });
      } else if (data.role === "admin" || data.role === "scanner") {
        await offlineService.storeAdminData(data);
      }
      console.log("✅ Offline data cached successfully");
    } catch (offlineErr) {
      console.warn("⚠️ Offline storage failed (non-fatal):", offlineErr);
    }

    // ─── 8. NAVIGATE ──────────────────────────────────────────────
    setIsLoading(false);

    if (data.role === "student") {
      navigate("/student-id");
    } else if (data.role === "admin" || data.role === "scanner") {
      navigate("/admin-dashboard");
    } else {
      console.warn("⚠️ Unknown role:", data.role);
      setError("Unknown user role. Contact administrator.");
    }
  };

  return (
    <div className="lp-page">

      {/* ── Page-level heading (outside card) ── */}
      <div className="lp-page-header">
        <h1 className="lp-page-title">NUTECH Secure Enterance Management System</h1>
        <p className="lp-page-subtitle">
          Secure, Offline-Capable Digital ID Verification
        </p>
      </div>

      {/* ── Card ── */}
      <div className="lp-card">

        {/* Logo inside card, centered at top */}
        <div className="lp-card-logo-wrap">
          <img
            src="./NUTECH_logo.png"
            alt="NUTECH Logo"
            className="lp-card-logo"
            onError={(e) => {
              console.warn("⚠️ Logo image not found, using fallback");
              e.target.style.display = "none";
              document.getElementById("lp-logo-fallback")?.classList.remove("lp-hidden");
            }}
          />
          <div id="lp-logo-fallback" className="lp-logo-fallback lp-hidden">
            <span>NUTECH</span>
          </div>
        </div>

        {/* Card title */}
        <h2 className="lp-card-title">Login</h2>

        {/* Form */}
        <form className="lp-form" onSubmit={handleLogin}>

          {/* Student / Admin ID field */}
          <div className={`lp-field${error ? " lp-field--error" : ""}`}>
            <span className="lp-field-icon">
              {/* Person icon */}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            </span>
            <input
              type="text"
              className="lp-input"
              placeholder="Student ID or Admin ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {/* Password field */}
          <div className={`lp-field${error ? " lp-field--error" : ""}`}>
            <span className="lp-field-icon">
              {/* Lock icon */}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              className="lp-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="lp-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                /* Eye-off */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                /* Eye */
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="lp-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.195 3 1.732 3z"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className={`lp-submit-btn${isLoading ? " lp-submit-btn--loading" : ""}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="lp-spinner"></span>
                Authenticating...
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Security note */}
        <div className="lp-security-note">
          <span className="lp-security-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
          </span>
          <span>This system is protected. Unauthorized access is monitored.</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="lp-footer">
        © 2024 National University of Technology. All rights reserved.
      </footer>
    </div>
  );
};

export default Login;