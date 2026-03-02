/**
 * Client/src/pages/RegisterStudent.jsx
 * Light theme matching AdminDashboard. Uses pg- / rs- CSS namespace.
 *
 * FIX: `Field` and `PasswordField` were defined INSIDE RegisterStudent.
 * Every render created a new function reference, React unmounted/remounted
 * the <input> on each keystroke, stealing focus. Fixed by moving both
 * helpers OUTSIDE the component so they have stable identity across renders.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import API_BASE from "../config/api";
import AdminSidebar from "../components/AdminSidebar";

const PROGRAMS = [
  "Software Engineering", "Computer Science", "Electrical Engineering",
  "Mechanical Engineering", "Civil Engineering", "Business Administration",
  "Information Technology",
];
const DEPARTMENTS = [
  "Computer Science", "Electrical Engineering", "Mechanical Engineering",
  "Civil Engineering", "Business Studies", "Mathematics", "Physics",
];

const apiFetch = async (url, options = {}) => {
  let response;
  try { response = await fetch(url, options); }
  catch { throw new Error("Cannot reach the server. Please check your connection."); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Unexpected server response. Please try again."); }
  if (!response.ok || data.success === false)
    throw new Error(data.message || `Request failed (status ${response.status})`);
  return data;
};

const EMPTY_FORM = {
  name: "", studentId: "", imageLink: "",
  email: "", phone: "",
  program: "", department: "", year: "1",
  password: "", confirmPassword: "",
};

/* ─────────────────────────────────────────────────────────────────────────────
   Helper components defined OUTSIDE RegisterStudent so their identity is
   stable across renders. Defined inside would cause React to treat them as
   a new component type every render → unmount/remount → focus loss.
───────────────────────────────────────────────────────────────────────────── */

const FormField = ({ label, name, type = "text", value, onChange, error, hint, placeholder, mono }) => (
  <div className="rs-field-wrap">
    <label className="rs-label">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete="off"
      style={mono ? { fontFamily: "monospace", letterSpacing: "0.04em", textTransform: "uppercase" } : undefined}
      className={`rs-input${error ? " rs-input--error" : ""}`}
    />
    {error && <p className="rs-error-msg">{error}</p>}
    {!error && hint && <p className="rs-hint">{hint}</p>}
  </div>
);

const PasswordField = ({ label, name, value, onChange, error, placeholder, show, onToggle }) => (
  <div className="rs-field-wrap">
    <label className="rs-label">{label}</label>
    <div className="rs-pass-wrap">
      <input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        className={`rs-input${error ? " rs-input--error" : ""}`}
      />
      <button type="button" className="rs-eye-btn" onClick={onToggle} tabIndex={-1}>
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
    {error && <p className="rs-error-msg">{error}</p>}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────── */

const RegisterStudent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState("");
  const [apiError,    setApiError]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  useEffect(() => {
    const token = getToken(), role = getRole();
    if (!token || role !== "admin") { removeToken(); navigate("/"); }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
    setSuccess(""); setApiError("");
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name      = "Full name is required";
    if (!form.studentId.trim())  e.studentId = "Student ID is required";
    else if (!/^[A-Z0-9\-_]+$/i.test(form.studentId.trim()))
                                 e.studentId = "Student ID can only contain letters, numbers, hyphens or underscores";
    if (!form.email.trim())      e.email     = "Email address is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
                                 e.email     = "Enter a valid email address";
    if (!form.phone.trim())      e.phone     = "Phone number is required";
    if (!form.program)           e.program   = "Please select a program";
    if (!form.department)        e.department = "Please select a department";
    const yr = parseInt(form.year, 10);
    if (isNaN(yr) || yr < 1 || yr > 10)
                                 e.year      = "Year must be between 1 and 10";
    if (!form.password)          e.password  = "Password is required";
    else if (form.password.length < 8)
                                 e.password  = "Password must be at least 8 characters";
    if (!form.confirmPassword)   e.confirmPassword = "Please confirm the password";
    else if (form.password !== form.confirmPassword)
                                 e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true); setApiError(""); setSuccess("");
    try {
      await apiFetch(`${API_BASE}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          name:       form.name.trim(),
          studentId:  form.studentId.trim().toUpperCase(),
          email:      form.email.trim(),
          phone:      form.phone.trim(),
          program:    form.program,
          department: form.department,
          year:       parseInt(form.year, 10),
          password:   form.password,
          imageLink:  form.imageLink.trim() || undefined,
        }),
      });
      setSuccess(`Student "${form.name}" (${form.studentId.toUpperCase()}) registered successfully!`);
      setForm(EMPTY_FORM);
      setErrors({});
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSuccess("");
    setApiError("");
  };

  return (
    <div className="ad-layout">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="ad-main">

        {/* ── Top bar ── */}
        <div className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <span/><span/><span/>
            </button>
            <h1 className="pg-page-title">Register New Student</h1>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-topbar-btn" onClick={handleReset}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Reset Form
            </button>
          </div>
        </div>

        {/* ── Page body ── */}
        <div className="pg-content pg-content--narrow">

          {/* Alerts */}
          {success && (
            <div className="pg-alert pg-alert--success" style={{ marginBottom: "1.25rem" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {success}
            </div>
          )}
          {apiError && (
            <div className="pg-alert pg-alert--error" style={{ marginBottom: "1.25rem" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {apiError}
            </div>
          )}

          {/* ── Personal Information ── */}
          <div className="pg-card" style={{ marginBottom: "1rem" }}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Personal Information
            </div>
            <div className="rs-grid-2">
              <FormField
                label="Full Name *" name="name"
                value={form.name} onChange={handleChange}
                error={errors.name} placeholder="e.g. Muhammad Sohail"
              />
              <FormField
                label="Student ID *" name="studentId"
                value={form.studentId} onChange={handleChange}
                error={errors.studentId} placeholder="e.g. NSE202601 or EE-2024-01"
                hint="Any alphanumeric format (letters, numbers, hyphens)" mono
              />
            </div>
            <div className="rs-field-wrap" style={{ marginTop: "0.75rem" }}>
              <label className="rs-label">
                Profile Image URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="url" name="imageLink" value={form.imageLink} onChange={handleChange}
                placeholder="https://example.com/photo.jpg"
                autoComplete="off"
                className="rs-input"
              />
              <p className="rs-hint">Direct link to student's photo — leave blank to use placeholder</p>
            </div>
          </div>

          {/* ── Contact Details ── */}
          <div className="pg-card" style={{ marginBottom: "1rem" }}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              Contact Details
            </div>
            <div className="rs-grid-2">
              <FormField
                label="Email Address *" name="email" type="email"
                value={form.email} onChange={handleChange}
                error={errors.email} placeholder="student@nutech.edu.pk"
              />
              <FormField
                label="Phone Number *" name="phone"
                value={form.phone} onChange={handleChange}
                error={errors.phone} placeholder="+923001234567"
                hint="+923001234567 or 03001234567"
              />
            </div>
          </div>

          {/* ── Academic Details ── */}
          <div className="pg-card" style={{ marginBottom: "1rem" }}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Academic Details
            </div>
            <div className="rs-grid-2">
              {/* Program */}
              <div className="rs-field-wrap">
                <label className="rs-label">Program *</label>
                <select name="program" value={form.program} onChange={handleChange}
                  className={`rs-input rs-select${errors.program ? " rs-input--error" : ""}`}>
                  <option value="">Select program…</option>
                  {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {errors.program && <p className="rs-error-msg">{errors.program}</p>}
              </div>

              {/* Department */}
              <div className="rs-field-wrap">
                <label className="rs-label">Department *</label>
                <select name="department" value={form.department} onChange={handleChange}
                  className={`rs-input rs-select${errors.department ? " rs-input--error" : ""}`}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="rs-error-msg">{errors.department}</p>}
              </div>

              {/* Year */}
              <div className="rs-field-wrap">
                <label className="rs-label">Academic Year *</label>
                <select name="year" value={form.year} onChange={handleChange}
                  className={`rs-input rs-select${errors.year ? " rs-input--error" : ""}`}>
                  {[1,2,3,4,5,6,7,8,9,10].map(y => (
                    <option key={y} value={y}>{y}{y===1?"st":y===2?"nd":y===3?"rd":"th"} Year</option>
                  ))}
                </select>
                {errors.year && <p className="rs-error-msg">{errors.year}</p>}
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div className="pg-card" style={{ marginBottom: "1.5rem" }}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Security
            </div>
            <div className="rs-grid-2">
              <PasswordField
                label="Password *" name="password"
                value={form.password} onChange={handleChange}
                error={errors.password} placeholder="Min 8 characters"
                show={showPass} onToggle={() => setShowPass(v => !v)}
              />
              <PasswordField
                label="Confirm Password *" name="confirmPassword"
                value={form.confirmPassword} onChange={handleChange}
                error={errors.confirmPassword} placeholder="Repeat password"
                show={showConfirm} onToggle={() => setShowConfirm(v => !v)}
              />
            </div>
          </div>

          {/* ── Submit ── */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="pg-modal-btn pg-modal-btn--cancel" onClick={handleReset}>
              Reset Form
            </button>
            <button type="button" className="pg-submit-btn" onClick={handleSubmit} disabled={loading} style={{ minWidth: "160px" }}>
              {loading ? (
                <><span className="pg-btn-spinner"/>Registering…</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  Register Student
                </>
              )}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default RegisterStudent;