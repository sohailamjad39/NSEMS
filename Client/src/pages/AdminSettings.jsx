/**
 * Client/src/pages/AdminSettings.jsx
 * Light theme matching AdminDashboard. Robust API error handling.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import API_BASE from "../config/api";
import AdminSidebar from "../components/AdminSidebar";
import ConfirmDialog from "../components/ConfirmDialog";

const AdminSettings = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const [cpForm,    setCpForm]    = useState({currentPassword:"",newPassword:"",confirmPassword:""});
  const [cpErrors,  setCpErrors]  = useState({});
  const [cpLoading, setCpLoading] = useState(false);
  const [cpSuccess, setCpSuccess] = useState("");
  const [cpApiErr,  setCpApiErr]  = useState("");
  const [showCp,    setShowCp]    = useState({current:false,new:false,confirm:false});
  const [confirmPw, setConfirmPw] = useState(false);

  const adminName  = localStorage.getItem("adminName")  || "Administrator";
  const adminRole  = localStorage.getItem("role")        || "admin";
  const adminEmail = localStorage.getItem("adminEmail")  || "—";

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
    if (!token || (role !== "admin" && role !== "scanner")) { removeToken(); navigate("/"); }
  }, [navigate]);

  const validateCp = () => {
    const e = {};
    if (!cpForm.currentPassword)                           e.currentPassword = "Current password is required";
    if (!cpForm.newPassword || cpForm.newPassword.length < 8) e.newPassword  = "Min 8 characters";
    if (cpForm.newPassword && cpForm.newPassword === cpForm.currentPassword) e.newPassword = "New password must differ from current";
    if (cpForm.newPassword !== cpForm.confirmPassword)     e.confirmPassword = "Passwords do not match";
    setCpErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCpChange = (e) => {
    const { name, value } = e.target;
    setCpForm(p => ({ ...p, [name]: value }));
    if (cpErrors[name]) setCpErrors(p => ({ ...p, [name]: "" }));
    setCpSuccess(""); setCpApiErr("");
  };

  const handleCpSubmit = (e) => {
    e.preventDefault();
    if (validateCp()) setConfirmPw(true);
  };

  const submitPasswordChange = async () => {
    setConfirmPw(false);
    setCpLoading(true); setCpApiErr(""); setCpSuccess("");

    let response, data;
    try {
      response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method:"POST",
        headers:{"Content-Type":"application/json", Authorization:`Bearer ${getToken()}`},
        body: JSON.stringify({currentPassword:cpForm.currentPassword, newPassword:cpForm.newPassword}),
      });
    } catch {
      setCpApiErr("Cannot reach the server. Password was NOT changed.");
      setCpLoading(false); return;
    }
    try { data = await response.json(); }
    catch {
      setCpApiErr("Unexpected server response. Please try again.");
      setCpLoading(false); return;
    }
    if (!response.ok || !data.success) {
      setCpApiErr(data.message || `Failed (status ${response.status})`);
      setCpLoading(false); return;
    }
    setCpSuccess("Password changed successfully!");
    setCpForm({currentPassword:"",newPassword:"",confirmPassword:""});
    setCpErrors({});
    setCpLoading(false);
  };

  const EyeIcon = ({show}) => show
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

  return (
    <div className="ad-layout">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="ad-main">

        <div className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <span/><span/><span/>
            </button>
            <h1 className="pg-page-title">Settings</h1>
          </div>
        </div>

        <div className="pg-content pg-content--narrow">
          {/* Profile card */}
          <div className="pg-card">
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Account Information
            </div>
            <div className="pg-profile-row">
              <div className="pg-profile-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor" width="30" height="30">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
              <div>
                <p className="pg-profile-name">{adminName}</p>
                <p className="pg-profile-email">{adminEmail}</p>
                <span className="pg-badge pg-badge--active" style={{textTransform:"capitalize",marginTop:"0.3rem",display:"inline-block"}}>
                  {adminRole}
                </span>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="pg-card" style={{marginTop:"1rem"}}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Change Password
            </div>

            {cpSuccess && (
              <div className="pg-alert pg-alert--success" style={{marginBottom:"1rem"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{flexShrink:0}}><polyline points="20 6 9 17 4 12"/></svg>
                {cpSuccess}
              </div>
            )}
            {cpApiErr && (
              <div className="pg-alert pg-alert--error" style={{marginBottom:"1rem"}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {cpApiErr}
              </div>
            )}

            <form onSubmit={handleCpSubmit} noValidate>
              <div className="pg-form-grid">
                {[
                  {label:"Current Password *", name:"currentPassword", key:"current"},
                  {label:"New Password *",      name:"newPassword",     key:"new"},
                  {label:"Confirm Password *",  name:"confirmPassword", key:"confirm"},
                ].map(({label,name,key}) => (
                  <div className="pg-field" key={name}>
                    <label className="pg-label">{label}</label>
                    <div className="pg-pass-wrap">
                      <input
                        type={showCp[key] ? "text" : "password"}
                        name={name} value={cpForm[name]} onChange={handleCpChange}
                        placeholder="••••••••"
                        className={`pg-input${cpErrors[name]?" pg-input--error":""}`}
                        autoComplete={key==="current"?"current-password":"new-password"}
                      />
                      <button type="button" className="pg-eye-btn"
                        onClick={() => setShowCp(p => ({...p,[key]:!p[key]}))} tabIndex={-1}>
                        <EyeIcon show={showCp[key]}/>
                      </button>
                    </div>
                    {cpErrors[name] && <p className="pg-field-error">{cpErrors[name]}</p>}
                  </div>
                ))}
              </div>
              <button type="submit" className="pg-submit-btn" disabled={cpLoading} style={{marginTop:"1rem"}}>
                {cpLoading
                  ? <><span className="pg-btn-spinner"/>Changing Password…</>
                  : <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      Change Password
                    </>
                }
              </button>
            </form>
          </div>

          {/* System info */}
          <div className="pg-card" style={{marginTop:"1rem"}}>
            <div className="pg-card-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              System Information
            </div>
            <div className="pg-info-grid">
              {[
                {label:"System",      value:"NSEMS — NUTECH Student ID System"},
                {label:"Version",     value:"1.0.0"},
                {label:"Environment", value:navigator.onLine ? "Connected" : "Offline"},
                {label:"Browser",     value:navigator.userAgent.split(" ").slice(-1)[0]},
              ].map(({label,value}) => (
                <div className="pg-info-row" key={label}>
                  <span className="pg-info-label">{label}</span>
                  <span className="pg-info-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        isOpen={confirmPw}
        title="Confirm Password Change"
        message="Are you sure you want to change your password? You will need to use the new password on your next login."
        confirmLabel="Yes, Change Password"
        onConfirm={submitPasswordChange}
        onCancel={() => setConfirmPw(false)}
      />
    </div>
  );
};

export default AdminSettings;