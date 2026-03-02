/**
 * Client/src/pages/StudentDashboard.jsx
 *
 * Student ID Card dashboard with exact UI matching the design image
 *
 * Features:
 * - Professional institutional ID card layout
 * - NUTECH branding with logo
 * - QR code with countdown timer
 * - Responsive design for all devices
 * - Preserves all existing logic and functionality
 * - Pure CSS only (no Tailwind / Material UI)
 */

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getStudentId, getStudentName, removeToken } from "../services/auth";
import ChangePasswordModal from "../components/ChangePasswordModal";
import API_BASE from "../config/api";
import {
  generateQR,
  startQRRefresh,
  stopQRRefresh,
  onQRUpdate,
  getTimeRemaining,
  isQRValid,
} from "../services/qrService";
import QRCode from "qrcode";

const QR_SIZE = 200;

const StudentDashboard = () => {
  const [qrData, setQrData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [error, setError] = useState(null);
  const [studentImage, setStudentImage] = useState("");
  const [studentInfo, setStudentInfo] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Initialize student dashboard
  useEffect(() => {
    const initDashboard = async () => {
      const studentId = getStudentId();
      if (!studentId) {
        removeToken();
        navigate("/");
        return;
      }

      // Set student info
      setStudentInfo({
        id: studentId,
        name: getStudentName() || "Student Name",
      });

      setStudentImage(localStorage.getItem("studentImage") || "");

      // Initialize QR generation
      try {
        const qr = await generateQR();
        setQrData(qr);
        setTimeRemaining(getTimeRemaining());
      } catch (err) {
        console.error("Initial QR generation failed:", err);
        setError(err.message || "Failed to generate QR code");
      }

      // Start auto-refresh
      startQRRefresh();
    };

    initDashboard();

    return () => {
      stopQRRefresh();
    };
  }, [navigate]);

  // Subscribe to QR updates
  useEffect(() => {
    const unsubscribe = onQRUpdate((qr) => {
      if (qr?.success) {
        setQrData(qr);
        setError(null);
      } else if (qr?.error) {
        setError(qr.error);
      }
    });

    return unsubscribe;
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!qrData) return;

    const timer = setInterval(() => {
      const remaining = getTimeRemaining();
      setTimeRemaining(remaining);

      if (!isQRValid() && qrData) {
        generateQR().catch((err) => {
          console.error("QR regeneration failed:", err);
          setError("Failed to regenerate QR code");
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData]);

  // Render QR to canvas
  useEffect(() => {
    if (!qrData?.success || !canvasRef.current) return;

    const renderQR = async () => {
      try {
        const canvas = canvasRef.current;
        await QRCode.toCanvas(canvas, qrData.token, {
          width: QR_SIZE,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
      } catch (err) {
        console.error("QR render error:", err);
        setError("Failed to render QR code");
      }
    };

    renderQR();
  }, [qrData]);

  // Handle logout
  const handleLogout = () => {
    removeToken();
    localStorage.removeItem("studentSecretKey");
    navigate("/");
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Loading state
  if (!studentInfo) {
    return (
      <div className="sd-loading-screen">
        <div className="sd-loading-spinner"></div>
        <p className="sd-loading-text">Loading your digital ID...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="sd-error-screen">
        <div className="sd-error-card">
          <div className="sd-error-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="sd-error-title">Authentication Error</h2>
          <p className="sd-error-message">{error}</p>
          <button onClick={handleLogout} className="sd-error-btn">
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sd-page">
        {/* Top Logo */}
        <div className="sd-top-logo-wrap">
          <img
            src="./NUTECH_logo.png"
            alt="National University of Technology Logo"
            className="sd-top-logo"
            onError={(e) => {
              e.target.style.display = "none";
              document
                .getElementById("sd-logo-fallback")
                ?.classList.remove("sd-hidden");
            }}
          />
          <div id="sd-logo-fallback" className="sd-logo-fallback sd-hidden">
            <span>NUTECH</span>
          </div>
        </div>

        {/* ID Card */}
        <div className="sd-card">
          {/* Card Header */}
          <div className="sd-card-header">
            <h2 className="sd-card-header-title">STUDENT ID CARD</h2>
          </div>

          {/* Card Body */}
          <div className="sd-card-body">
            {/* Left: Student photo + info + university branding */}
            <div className="sd-card-left">
              {/* Student photo + name/id/program */}
              <div className="sd-student-row">
                <div className="sd-photo-wrap">
                  {studentImage ? (
                    <img
                      src={studentImage}
                      alt="Student"
                      className="sd-photo"
                    />
                  ) : (
                    <div className="sd-photo-placeholder">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="sd-student-info">
                  <h3 className="sd-student-name">{studentInfo.name}</h3>
                  <div className="sd-student-divider"></div>
                  <p className="sd-student-detail">ID: {studentInfo.id}</p>
                  <div className="sd-student-divider"></div>
                  <p className="sd-student-detail">BS Computer Science</p>
                </div>
              </div>

              {/* University Branding Row */}
              <div className="sd-uni-row">
                <img
                  src="./NUTECH_logo.png"
                  alt="NUTECH"
                  className="sd-uni-logo"
                  onError={(e) => {
                    e.target.style.display = "none";
                    document
                      .getElementById("sd-uni-logo-fallback")
                      ?.classList.remove("sd-hidden");
                  }}
                />
                <div
                  id="sd-uni-logo-fallback"
                  className="sd-uni-logo-fallback sd-hidden"
                >
                  <span>N</span>
                </div>
                <div className="sd-uni-text">
                  <p className="sd-uni-name">NATIONAL</p>
                  <p className="sd-uni-name">UNIVERSITY OF</p>
                  <p className="sd-uni-name">TECHNOLOGY</p>
                </div>
              </div>
            </div>

            {/* Right: QR Code + timer */}
            <div className="sd-card-right">
              <div className="sd-qr-wrap">
                <canvas
                  ref={canvasRef}
                  width={QR_SIZE}
                  height={QR_SIZE}
                  className="sd-qr-canvas"
                />
              </div>
              <p className="sd-qr-label">
                QR Code changes every
                <br />
                60 seconds
              </p>
              <div className="sd-timer-row">
                {/* Refresh icon */}
                <svg
                  className="sd-timer-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span
                  className={`sd-timer-value ${timeRemaining <= 5 ? "sd-timer-expiring" : ""}`}
                >
                  {formatTime(timeRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Card Footer Bar */}
          <div className="sd-card-footer-bar"></div>
        </div>

        {/* Action Buttons */}
        <div className="sd-actions">
          <button
            onClick={() => setShowChangePw(true)}
            className="sd-action-btn"
          >
            <span className="sd-action-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <span className="sd-action-label">Change Password</span>
            <span className="sd-action-arrow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>

          <button className="sd-action-btn" onClick={handleLogout}>
            <span className="sd-action-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="sd-action-label">Logout</span>
          </button>
        </div>

        {/* Footer */}
        <p className="sd-footer-text">
          © 2026 National University of Technology. All rights reserved.
        </p>
      </div>
      <ChangePasswordModal
        isOpen={showChangePw}
        onClose={() => setShowChangePw(false)}
        apiEndpoint={`${API_BASE}/api/auth/change-password`}
      />
    </>
  );
};

export default StudentDashboard;
