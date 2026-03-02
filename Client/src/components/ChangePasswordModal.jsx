/**
 * Client/src/components/ChangePasswordModal.jsx
 *
 * Re-styled to match the dark admin dashboard UI (modal-, rs-, cd- classes
 * that already exist in App.css).  All original logic preserved; bugs fixed:
 *
 *  Bug 1 — 404:  was hitting localhost:5173 directly.  Now uses API_BASE
 *                from config/api so Vite proxy (or absolute backend URL)
 *                is respected.
 *  Bug 2 — "User not found":  was a backend bug (plain === bcrypt hash).
 *                Fixed in authController.js.  The modal itself already sent
 *                the right payload — no change needed here on the fetch side.
 *
 * UI changes:
 *  - Dark glass card matching .modal / .modal-header / .modal-body / .modal-footer
 *  - Input fields use .rs-input / .rs-pass-wrap / .rs-label / .rs-eye
 *  - Alerts use .rs-alert--success / .rs-alert--error
 *  - Buttons use .cd-btn / .cd-btn--confirm / .cd-btn--cancel
 *  - Password strength meter added
 *  - Smooth shake animation on validation error
 */

import React, { useState, useCallback } from "react";
import { getToken } from "../services/auth";
import ConfirmDialog from "./ConfirmDialog";
import API_BASE from "../config/api";

// ─── password-strength helper ─────────────────────────────────────────────────
const getStrength = (pw) => {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8)              score++;
  if (pw.length >= 12)             score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  const map = [
    { label: "",          color: "transparent" },
    { label: "Weak",      color: "#ef4444" },
    { label: "Fair",      color: "#f59e0b" },
    { label: "Good",      color: "#3b82f6" },
    { label: "Strong",    color: "#22c55e" },
    { label: "Very strong", color: "#16a34a" },
  ];
  return { score, ...map[Math.min(score, 5)] };
};

// ─────────────────────────────────────────────────────────────────────────────
const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [form,    setForm]    = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [apiErr,  setApiErr]  = useState("");
  const [showPw,  setShowPw]  = useState({ current: false, new: false, confirm: false });
  const [confirm, setConfirm] = useState(false);
  const [shake,   setShake]   = useState(false);

  if (!isOpen) return null;

  // ── helpers ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
    setSuccess("");
    setApiErr("");
    setShake(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const validate = () => {
    const e = {};
    if (!form.currentPassword)
      e.currentPassword = "Current password is required";
    if (!form.newPassword || form.newPassword.length < 8)
      e.newPassword = "New password must be at least 8 characters";
    if (form.newPassword && form.newPassword === form.currentPassword)
      e.newPassword = "New password must differ from current password";
    if (form.newPassword !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    setSuccess("");
    setApiErr("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      setConfirm(true);
    } else {
      triggerShake();
    }
  };

  // ── API call ─────────────────────────────────────────────────────────────────
  const doChange = async () => {
    setConfirm(false);
    setLoading(true);
    setApiErr("");
    setSuccess("");

    let response, data;

    // 1. Network request — uses API_BASE so proxy / absolute URL works
    try {
      response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword:     form.newPassword,
        }),
      });
    } catch (networkErr) {
      console.error("❌ Network error:", networkErr);
      setApiErr("Cannot reach the server. Make sure the backend is running.");
      setLoading(false);
      return;
    }

    // 2. Parse JSON
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error("❌ Failed to parse response:", parseErr);
      setApiErr("Unexpected server response. Please try again.");
      setLoading(false);
      return;
    }

    // 3. HTTP / app-level check
    if (!response.ok || !data.success) {
      setApiErr(data.message || `Failed (status ${response.status})`);
      triggerShake();
      setLoading(false);
      return;
    }

    // 4. Success
    setSuccess("Password changed successfully! Use your new password next time you log in.");
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setLoading(false);
  };

  const strength = getStrength(form.newPassword);

  // ── Eye toggle ───────────────────────────────────────────────────────────────
  const EyeBtn = ({ field }) => (
    <button
      type="button"
      className="rs-eye"
      onClick={() => setShowPw(prev => ({ ...prev, [field]: !prev[field] }))}
      tabIndex={-1}
      aria-label={showPw[field] ? "Hide password" : "Show password"}
    >
      {showPw[field] ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );

  // ── Field rows config ─────────────────────────────────────────────────────────
  const fields = [
    {
      label:       "Current Password",
      name:        "currentPassword",
      field:       "current",
      placeholder: "Enter your current password",
    },
    {
      label:       "New Password",
      name:        "newPassword",
      field:       "new",
      placeholder: "Min 8 characters",
      hint:        true, // shows strength meter
    },
    {
      label:       "Confirm New Password",
      name:        "confirmPassword",
      field:       "confirm",
      placeholder: "Re-enter new password",
    },
  ];

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="modal-backdrop" onClick={handleClose}>
        <div
          className={`modal cpm-modal${shake ? " cpm-shake" : ""}`}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cpm-title"
        >
          {/* ── Header ── */}
          <div className="modal-header">
            <div className="cpm-header-left">
              <div className="cpm-header-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  width="18" height="18">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h2 className="modal-title" id="cpm-title">Change Password</h2>
            </div>
            <button className="modal-close" onClick={handleClose} aria-label="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ── Alerts ── */}
          {success && (
            <div className="rs-alert rs-alert--success cpm-alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                width="16" height="16" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {success}
            </div>
          )}
          {apiErr && (
            <div className="rs-alert rs-alert--error cpm-alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                width="16" height="16" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {apiErr}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal-body">
              <p className="cpm-subtitle">
                Choose a strong password you haven't used before.
              </p>

              {fields.map(({ label, name, field, placeholder, hint }) => (
                <div className="rs-field-wrap cpm-field-wrap" key={name}>
                  <label className="rs-label" htmlFor={`cpm-${name}`}>{label} *</label>
                  <div className="rs-pass-wrap">
                    <input
                      id={`cpm-${name}`}
                      type={showPw[field] ? "text" : "password"}
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      placeholder={placeholder}
                      className={`rs-input${errors[name] ? " rs-input--error" : ""}`}
                      autoComplete={field === "current" ? "current-password" : "new-password"}
                      disabled={loading}
                    />
                    <EyeBtn field={field} />
                  </div>

                  {/* Password strength meter (new password only) */}
                  {hint && form.newPassword && (
                    <div className="cpm-strength">
                      <div className="cpm-strength-bars">
                        {[1,2,3,4,5].map(i => (
                          <span
                            key={i}
                            className="cpm-strength-bar"
                            style={{
                              background: i <= strength.score ? strength.color : "rgba(255,255,255,0.1)",
                              transition: "background 0.25s",
                            }}
                          />
                        ))}
                      </div>
                      <span className="cpm-strength-label" style={{ color: strength.color }}>
                        {strength.label}
                      </span>
                    </div>
                  )}

                  {errors[name] && (
                    <p className="rs-error-msg cpm-err-msg">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        width="11" height="11" style={{ flexShrink: 0 }}>
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      {errors[name]}
                    </p>
                  )}
                </div>
              ))}

              {/* Requirements hint */}
              <div className="cpm-requirements">
                <p className="cpm-req-title">Password requirements:</p>
                <ul className="cpm-req-list">
                  {[
                    { text: "At least 8 characters",     ok: form.newPassword.length >= 8 },
                    { text: "One uppercase letter",       ok: /[A-Z]/.test(form.newPassword) },
                    { text: "One number",                 ok: /[0-9]/.test(form.newPassword) },
                    { text: "Matches confirmation field", ok: form.newPassword && form.newPassword === form.confirmPassword },
                  ].map(({ text, ok }) => (
                    <li key={text} className={`cpm-req-item${ok ? " cpm-req-item--ok" : ""}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                        width="11" height="11">
                        {ok
                          ? <polyline points="20 6 9 17 4 12"/>
                          : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                        }
                      </svg>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="modal-footer">
              <button type="button" className="cd-btn cd-btn--cancel" onClick={handleClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="cd-btn cd-btn--confirm" disabled={loading}>
                {loading ? (
                  <>
                    <span className="rs-spinner" style={{ width: 13, height: 13 }} />
                    Changing…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      width="14" height="14">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        isOpen={confirm}
        title="Confirm Password Change"
        message="Are you sure you want to change your password? You'll need to use the new password next time you log in."
        confirmLabel="Yes, Change It"
        onConfirm={doChange}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
};

export default ChangePasswordModal;