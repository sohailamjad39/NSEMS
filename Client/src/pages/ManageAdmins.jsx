/**
 * Client/src/pages/ManageAdmins.jsx
 * Light theme matching AdminDashboard. Robust API error handling.
 *
 * FIX: The `Field` component was defined INSIDE ManageAdmins. Every render
 * created a new function reference, so React treated it as a different
 * component type each render, unmounted and remounted the <input>, which
 * instantly stole focus after every keystroke. Fixed by inlining all inputs
 * directly in JSX — no sub-component wrapper needed.
 *
 * ADDED (existing logic unchanged):
 *  - Module-level `adminsCache` persists across React route navigation.
 *    On mount: use cache if available, skip network call.
 *  - After each fetch: write to offlineService.cacheAdmins() for offline.
 *  - Offline fallback: read from offlineService.getCachedAdmins().
 *  - Refresh button: always bypasses cache, hits network.
 *  - Add/Edit/Delete mutations keep the in-memory cache in sync.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import API_BASE from "../config/api";
import AdminSidebar from "../components/AdminSidebar";
import ConfirmDialog from "../components/ConfirmDialog";
import { offlineService } from "../services/offlineService";

const ROLES = ["All Roles", "admin", "scanner"];

// ── Module-level in-memory cache ─────────────────────────────────────────────
let adminsCache = null; // null = never loaded; Array = loaded

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

const ManageAdmins = () => {
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [admins,       setAdmins]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All Roles");

  const [showAdd,    setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState({ name: "", email: "", phone: "", password: "", role: "admin" });
  const [addErrors,  setAddErrors]  = useState({});
  const [addLoading, setAddLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState("");
  const [addApiErr,  setAddApiErr]  = useState("");

  const [editAdmin,   setEditAdmin]   = useState(null);
  const [editForm,    setEditForm]    = useState({});
  const [editErrors,  setEditErrors]  = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState("");
  const [editApiErr,  setEditApiErr]  = useState("");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const navigate     = useNavigate();
  const isMountedRef = useRef(true);

  const myId = (() => {
    try { const t = getToken(); if (!t) return null; return JSON.parse(atob(t.split(".")[1])).id; }
    catch { return null; }
  })();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
    if (!token || role !== "admin") { removeToken(); navigate("/"); return; }
    loadAdmins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── loadAdmins: cache-first ──────────────────────────────────────────────
  const loadAdmins = async () => {
    // 1. In-memory cache hit
    if (adminsCache !== null) {
      setAdmins(adminsCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    // 2. Offline — try IndexedDB
    if (!navigator.onLine) {
      try {
        const cached = await offlineService.getCachedAdmins();
        if (cached && cached.admins?.length > 0) {
          adminsCache = cached.admins;
          setAdmins(cached.admins);
        } else {
          setError("You are offline and no cached admin data is available.");
        }
      } catch {
        setError("Failed to load offline data.");
      }
      if (isMountedRef.current) setLoading(false);
      return;
    }

    // 3. Online — fetch from server
    try {
      const data = await apiFetch(`${API_BASE}/api/admins`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.admins || [];
      adminsCache = list;
      setAdmins(list);
      offlineService.cacheAdmins(list).catch(() => {});
    } catch (e) {
      setError(e.message);
      // Last resort: try IndexedDB
      try {
        const cached = await offlineService.getCachedAdmins();
        if (cached && cached.admins?.length > 0) {
          adminsCache = cached.admins;
          setAdmins(cached.admins);
          setError("");
        }
      } catch { /* keep original error */ }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // ── fetchAdmins: Refresh button — always hits network ────────────────────
  const fetchAdmins = async () => {
    setLoading(true); setError("");
    try {
      const data = await apiFetch(`${API_BASE}/api/admins`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.admins || [];
      adminsCache = list;
      setAdmins(list);
      offlineService.cacheAdmins(list).catch(() => {});
    } catch (e) { setError(e.message); }
    finally     { if (isMountedRef.current) setLoading(false); }
  };

  const filtered = admins.filter(a => {
    const q = search.toLowerCase();
    return (!q || a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
      && (roleFilter === "All Roles" || a.role === roleFilter);
  });

  /* ── Add ── */
  const handleAddChange = (e) => {
    const { name, value } = e.target;
    setAddForm(p => ({ ...p, [name]: value }));
    if (addErrors[name]) setAddErrors(p => ({ ...p, [name]: "" }));
    setAddSuccess(""); setAddApiErr("");
  };

  const validateAdd = () => {
    const e = {};
    if (!addForm.name?.trim())                            e.name     = "Name required";
    if (!addForm.email)                                   e.email    = "Email required";
    if (!addForm.phone)                                   e.phone    = "Phone required";
    if (!addForm.password || addForm.password.length < 8) e.password = "Min 8 characters";
    setAddErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitAdd = async () => {
    if (!validateAdd()) return;
    setAddLoading(true); setAddApiErr(""); setAddSuccess("");
    try {
      await apiFetch(`${API_BASE}/api/admins/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(addForm),
      });
      setAddSuccess(`${addForm.role === "admin" ? "Admin" : "Scanner"} "${addForm.name}" created!`);
      setAddForm({ name: "", email: "", phone: "", password: "", role: "admin" });
      setAddErrors({});
      adminsCache = null; // invalidate cache — fetchAdmins will repopulate
      fetchAdmins();
    } catch (e) { setAddApiErr(e.message); }
    finally     { setAddLoading(false); }
  };

  /* ── Edit ── */
  const openEdit = (a) => {
    setEditAdmin(a);
    setEditForm({ name: a.name || "", email: a.email || "", phone: a.phone || "", role: a.role || "admin" });
    setEditErrors({}); setEditSuccess(""); setEditApiErr("");
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(p => ({ ...p, [name]: value }));
    if (editErrors[name]) setEditErrors(p => ({ ...p, [name]: "" }));
    setEditSuccess(""); setEditApiErr("");
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.name?.trim()) e.name  = "Name required";
    if (!editForm.email)        e.email = "Email required";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitEdit = async () => {
    if (!validateEdit()) return;
    setEditLoading(true); setEditApiErr(""); setEditSuccess("");
    try {
      await apiFetch(`${API_BASE}/api/admins/${editAdmin._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(editForm),
      });
      setEditSuccess("Admin updated successfully!");
      const updated = admins.map(a => a._id === editAdmin._id ? { ...a, ...editForm } : a);
      setAdmins(updated);
      adminsCache = updated;
      offlineService.cacheAdmins(updated).catch(() => {});
    } catch (e) { setEditApiErr(e.message); }
    finally     { setEditLoading(false); }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`${API_BASE}/api/admins/${confirmDelete._id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
      });
      const updated = admins.filter(a => a._id !== confirmDelete._id);
      setAdmins(updated);
      adminsCache = updated;
      offlineService.cacheAdmins(updated).catch(() => {});
      setConfirmDelete(null);
    } catch (e) { alert(e.message); setConfirmDelete(null); }
    finally     { setDeleteLoading(false); }
  };

  return (
    <div className="ad-layout">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="ad-main">

        <div className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <span/><span/><span/>
            </button>
            <h1 className="pg-page-title">Manage Admins</h1>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-topbar-btn pg-add-btn"
              onClick={() => { setShowAdd(true); setAddSuccess(""); setAddApiErr(""); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Admin
            </button>
            <button className="ad-topbar-btn" onClick={fetchAdmins}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="pg-content">
          <div className="pg-filters">
            <div className="pg-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="pg-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="pg-search" placeholder="Search by name or email…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="pg-search-clear" onClick={() => setSearch("")}>×</button>}
            </div>
            <select className="pg-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          <p className="pg-count">Showing {filtered.length} of {admins.length} admins</p>

          {error && (
            <div className="pg-alert pg-alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ flex: 1 }}>{error}</span>
              <button className="pg-retry-btn" onClick={fetchAdmins}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="pg-loading"><div className="pg-spinner"/><span>Loading admins…</span></div>
          ) : (
            <div className="pg-table-card">
              <div className="pg-table-wrap">
                <table className="pg-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={5} className="pg-empty">No admins found</td></tr>
                    ) : filtered.map(a => (
                      <tr key={a._id}>
                        <td>
                          <p className="pg-cell-primary">{a.name}</p>
                          {String(a._id) === String(myId) && (
                            <span className="pg-badge pg-badge--active" style={{ fontSize: "0.6rem", marginTop: "0.2rem", display: "inline-block" }}>You</span>
                          )}
                        </td>
                        <td className="pg-cell-sub">{a.email}</td>
                        <td className="pg-cell-sub">{a.phone || "—"}</td>
                        <td><span className={`pg-badge ${a.role === "admin" ? "pg-badge--active" : "pg-badge--graduated"}`}>{a.role}</span></td>
                        <td>
                          <div className="pg-actions">
                            <button className="pg-btn pg-btn--edit" onClick={() => openEdit(a)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit
                            </button>
                            {String(a._id) !== String(myId) && (
                              <button className="pg-btn pg-btn--delete" onClick={() => setConfirmDelete(a)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ══ Add Modal ══ */}
        {showAdd && (
          <div className="pg-modal-backdrop" onClick={() => setShowAdd(false)}>
            <div className="pg-modal" onClick={e => e.stopPropagation()}>
              <div className="pg-modal-header">
                <h2 className="pg-modal-title">Add Admin / Scanner</h2>
                <button className="pg-modal-close" onClick={() => setShowAdd(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {addSuccess && (
                <div className="pg-alert pg-alert--success" style={{ margin: "0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {addSuccess}
                </div>
              )}
              {addApiErr && (
                <div className="pg-alert pg-alert--error" style={{ margin: "0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {addApiErr}
                </div>
              )}

              <div className="pg-modal-body">
                <div className="pg-form-grid">
                  <div className="pg-field">
                    <label className="pg-label">Full Name *</label>
                    <input name="name" value={addForm.name} onChange={handleAddChange} autoComplete="off"
                      placeholder="e.g. Ali Hassan"
                      className={`pg-input${addErrors.name ? " pg-input--error" : ""}`}/>
                    {addErrors.name && <p className="pg-field-error">{addErrors.name}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Email *</label>
                    <input name="email" type="email" value={addForm.email} onChange={handleAddChange} autoComplete="off"
                      placeholder="admin@example.com"
                      className={`pg-input${addErrors.email ? " pg-input--error" : ""}`}/>
                    {addErrors.email && <p className="pg-field-error">{addErrors.email}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Phone *</label>
                    <input name="phone" value={addForm.phone} onChange={handleAddChange} autoComplete="off"
                      placeholder="+923001234567"
                      className={`pg-input${addErrors.phone ? " pg-input--error" : ""}`}/>
                    {addErrors.phone && <p className="pg-field-error">{addErrors.phone}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Password *</label>
                    <input name="password" type="password" value={addForm.password} onChange={handleAddChange} autoComplete="new-password"
                      placeholder="Min 8 characters"
                      className={`pg-input${addErrors.password ? " pg-input--error" : ""}`}/>
                    {addErrors.password && <p className="pg-field-error">{addErrors.password}</p>}
                  </div>
                </div>
                <div className="pg-field" style={{ marginTop: "0.75rem" }}>
                  <label className="pg-label">Role</label>
                  <select name="role" value={addForm.role} onChange={handleAddChange} className="pg-input pg-select-input">
                    <option value="admin">Admin</option>
                    <option value="scanner">Scanner</option>
                  </select>
                </div>
              </div>

              <div className="pg-modal-footer">
                <button className="pg-modal-btn pg-modal-btn--cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="pg-modal-btn pg-modal-btn--confirm" onClick={submitAdd} disabled={addLoading}>
                  {addLoading ? <><span className="pg-btn-spinner"/>Creating…</> : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ Edit Modal ══ */}
        {editAdmin && (
          <div className="pg-modal-backdrop" onClick={() => setEditAdmin(null)}>
            <div className="pg-modal" onClick={e => e.stopPropagation()}>
              <div className="pg-modal-header">
                <h2 className="pg-modal-title">Edit Admin</h2>
                <button className="pg-modal-close" onClick={() => setEditAdmin(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {editSuccess && (
                <div className="pg-alert pg-alert--success" style={{ margin: "0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {editSuccess}
                </div>
              )}
              {editApiErr && (
                <div className="pg-alert pg-alert--error" style={{ margin: "0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {editApiErr}
                </div>
              )}

              <div className="pg-modal-body">
                <div className="pg-form-grid">
                  <div className="pg-field">
                    <label className="pg-label">Full Name *</label>
                    <input name="name" value={editForm.name || ""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.name ? " pg-input--error" : ""}`}/>
                    {editErrors.name && <p className="pg-field-error">{editErrors.name}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Email *</label>
                    <input name="email" type="email" value={editForm.email || ""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.email ? " pg-input--error" : ""}`}/>
                    {editErrors.email && <p className="pg-field-error">{editErrors.email}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Phone</label>
                    <input name="phone" value={editForm.phone || ""} onChange={handleEditChange} autoComplete="off" className="pg-input"/>
                  </div>
                </div>
                <div className="pg-field" style={{ marginTop: "0.75rem" }}>
                  <label className="pg-label">Role</label>
                  <select name="role" value={editForm.role || "admin"} onChange={handleEditChange} className="pg-input pg-select-input">
                    <option value="admin">Admin</option>
                    <option value="scanner">Scanner</option>
                  </select>
                </div>
              </div>

              <div className="pg-modal-footer">
                <button className="pg-modal-btn pg-modal-btn--cancel" onClick={() => setEditAdmin(null)}>Cancel</button>
                <button className="pg-modal-btn pg-modal-btn--confirm" onClick={submitEdit} disabled={editLoading}>
                  {editLoading ? <><span className="pg-btn-spinner"/>Saving…</> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={!!confirmDelete}
          title="Delete Admin"
          message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
          confirmLabel={deleteLoading ? "Deleting…" : "Delete"}
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </main>
    </div>
  );
};

export default ManageAdmins;