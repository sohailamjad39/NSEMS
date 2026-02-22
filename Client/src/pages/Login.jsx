/**
 * Client/src/pages/Login.jsx
 *
 * Login page – fixed error handling & offline-service isolation
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
  const [isHovered, setIsHovered] = useState({ id: false, password: false });
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
      // This ONLY fires for true network failures (server down, CORS block, DNS, etc.)
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
      // ⚠️ THIS was the silent killer – previously this threw inside the
      //    main try/catch and surfaced as "Network error"
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
    <div className="login-page">
      <div className="login-layout">
        {/* Header */}
        <div className="login-header">
          <img
            src="./NUTECH_logo.png"
            alt="NUTECH Logo"
            className="login-header__logo"
            onError={(e) => {
              console.warn("⚠️ Logo image not found, using fallback");
              e.target.style.display = "none";
            }}
          />
          <h1 className="login-header__title">
            Digital Student Identity System
          </h1>
          <p className="login-header__subtitle">
            Secure, Offline-Capable Digital ID Verification
          </p>
        </div>

        {/* Form */}
        <div className="login-form">
          <div className="login-card">
            <h2 className="login-card__title">Login</h2>

            <form onSubmit={handleLogin}>
              {/* Identifier Field */}
              <div
                className={`input-group ${isHovered.id ? "input-group--hover" : ""} ${error ? "input-group--error" : ""}`}
                onMouseEnter={() =>
                  setIsHovered((prev) => ({ ...prev, id: true }))
                }
                onMouseLeave={() =>
                  setIsHovered((prev) => ({ ...prev, id: false }))
                }
              >
                <div className="input-icon">
                  <img
                    src="./user.png"
                    alt="User"
                    className="input-icon__img"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML = "👤";
                    }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Student ID or Admin ID"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                  onFocus={() =>
                    setIsHovered((prev) => ({ ...prev, id: true }))
                  }
                  onBlur={() =>
                    setIsHovered((prev) => ({ ...prev, id: false }))
                  }
                  className="input-field"
                />
              </div>

              {/* Password Field */}
              <div
                className={`input-group ${isHovered.password ? "input-group--hover" : ""} ${error ? "input-group--error" : ""}`}
                onMouseEnter={() =>
                  setIsHovered((prev) => ({ ...prev, password: true }))
                }
                onMouseLeave={() =>
                  setIsHovered((prev) => ({ ...prev, password: false }))
                }
              >
                <div className="input-icon">
                  <img
                    src="./lock.png"
                    alt="Lock"
                    className="input-icon__img"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML = "🔒";
                    }}
                  />
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  onFocus={() =>
                    setIsHovered((prev) => ({ ...prev, password: true }))
                  }
                  onBlur={() =>
                    setIsHovered((prev) => ({ ...prev, password: false }))
                  }
                  className="input-field"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="error-message">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.195 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                className={`login-btn ${isLoading ? "btn-loading" : ""}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            {/* Security Badge */}
            <div className="security-badge">
              <div className="security-badge__icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div className="security-badge__text">
                <strong>Secure System</strong>
                <p>Unauthorized access is monitored in real-time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="login-footer">
          © 2024 National University of Technology. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Login;