/**
 * Client/src/pages/AllStudents.jsx
 * Light theme matching AdminDashboard.
 *
 * FIXES & ADDITIONS:
 *  - Year filter bug: option had no explicit value attr so "Year 1" was the value
 *    being stored in yearFilter but "1" was being compared. Fixed with value={y}.
 *  - Student ID validation relaxed: any alphanumeric/hyphen/underscore format.
 *  - Pagination: 10/20/50/100/custom rows per page with page-number controls.
 *  - Module-level cache preserved: no re-fetch on navigation.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import API_BASE from "../config/api";
import AdminSidebar from "../components/AdminSidebar";
import ConfirmDialog from "../components/ConfirmDialog";
import { offlineService } from "../services/offlineService";

const PROGRAMS = ["All Programs","Software Engineering","Computer Science","Electrical Engineering","Mechanical Engineering","Civil Engineering","Business Administration","Information Technology"];
const STATUSES = ["All Statuses","active","suspended","graduated"];
const YEARS    = ["All Years","1","2","3","4","5","6","7","8","9","10"];
const PAGE_SIZES = [10, 20, 50, 100];

// Module-level cache — survives route navigation, cleared only by Refresh
let studentsCache = null;

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

const AllStudents = () => {
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [students,     setStudents]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // Filters
  const [search,       setSearch]       = useState("");
  const [progFilter,   setProgFilter]   = useState("All Programs");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [yearFilter,   setYearFilter]   = useState("All Years");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(20);
  const [customSize,  setCustomSize]  = useState("");
  const [showCustom,  setShowCustom]  = useState(false);

  // Edit modal
  const [editStudent,  setEditStudent]  = useState(null);
  const [editForm,     setEditForm]     = useState({});
  const [editErrors,   setEditErrors]   = useState({});
  const [editLoading,  setEditLoading]  = useState(false);
  const [editSuccess,  setEditSuccess]  = useState("");
  const [editApiError, setEditApiError] = useState("");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    if (!token || role !== "admin") { removeToken(); navigate("/"); return; }
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => { setCurrentPage(1); }, [search, progFilter, statusFilter, yearFilter, pageSize]);

  // ── Cache-first load ──────────────────────────────────────────────────────
  const loadStudents = async () => {
    if (studentsCache !== null) {
      setStudents(studentsCache);
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    if (!navigator.onLine) {
      try {
        const cached = await offlineService.getAllStudents();
        if (cached?.length > 0) { studentsCache = cached; setStudents(cached); }
        else setError("You are offline and no cached student data is available.");
      } catch { setError("Failed to load offline data."); }
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch(`${API_BASE}/api/students/all-details`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.students || [];
      studentsCache = list;
      setStudents(list);
      list.forEach(s => offlineService.storeStudentData({
        studentId: s.studentId, name: s.name, program: s.program || "",
        department: s.department || "", year: s.year || 1,
        status: s.status || "active", imageLink: s.imageLink || "",
      }).catch(() => {}));
    } catch (e) {
      setError(e.message);
      try {
        const cached = await offlineService.getAllStudents();
        if (cached?.length > 0) { studentsCache = cached; setStudents(cached); setError(""); }
      } catch { /* keep error */ }
    } finally { setLoading(false); }
  };

  // Refresh — always hits network
  const fetchStudents = async () => {
    setLoading(true); setError("");
    try {
      const data = await apiFetch(`${API_BASE}/api/students/all-details`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.students || [];
      studentsCache = list;
      setStudents(list);
      setCurrentPage(1);
      list.forEach(s => offlineService.storeStudentData({
        studentId: s.studentId, name: s.name, program: s.program || "",
        department: s.department || "", year: s.year || 1,
        status: s.status || "active", imageLink: s.imageLink || "",
      }).catch(() => {}));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Filtering — year filter fix: Number(s.year) === Number(yearFilter) ────
  const filtered = useMemo(() => students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || s.name?.toLowerCase().includes(q)
      || s.studentId?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q);
    const matchProg   = progFilter   === "All Programs" || s.program === progFilter;
    const matchStatus = statusFilter === "All Statuses"  || s.status  === statusFilter;
    const matchYear   = yearFilter   === "All Years"     || Number(s.year) === Number(yearFilter);
    return matchSearch && matchProg && matchStatus && matchYear;
  }), [students, search, progFilter, statusFilter, yearFilter]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageSizeChange = (val) => {
    if (val === "custom") { setShowCustom(true); return; }
    setShowCustom(false);
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const applyCustomSize = () => {
    const n = parseInt(customSize, 10);
    if (!isNaN(n) && n >= 1) { setPageSize(n); setCurrentPage(1); setShowCustom(false); }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    if (safePage > 3) pages.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
    if (safePage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  // ── Edit / Delete ──────────────────────────────────────────────────────────
  const openEdit = (s) => {
    setEditStudent(s);
    setEditForm({
      name: s.name || "", email: s.email || "", phone: s.phone || "",
      studentId: s.studentId || "", program: s.program || "",
      department: s.department || "", year: String(s.year || "1"),
      status: s.status || "active", imageLink: s.imageLink || "",
    });
    setEditErrors({}); setEditSuccess(""); setEditApiError("");
  };
  const closeEdit = () => { setEditStudent(null); setEditForm({}); };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(p => ({ ...p, [name]: value }));
    if (editErrors[name]) setEditErrors(p => ({ ...p, [name]: "" }));
    setEditSuccess(""); setEditApiError("");
  };

  const validateEdit = () => {
    const e = {};
    if (!editForm.name?.trim())       e.name       = "Name is required";
    if (!editForm.email)              e.email      = "Email is required";
    if (!editForm.studentId?.trim())  e.studentId  = "Student ID is required";
    else if (!/^[A-Z0-9\-_]+$/i.test(editForm.studentId.trim()))
                                      e.studentId  = "Letters, numbers, hyphens or underscores only";
    if (!editForm.program?.trim())    e.program    = "Program required";
    if (!editForm.department?.trim()) e.department = "Department required";
    const yr = parseInt(editForm.year, 10);
    if (isNaN(yr) || yr < 1 || yr > 10) e.year = "Year must be 1–10";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitEdit = async () => {
    if (!validateEdit()) return;
    setEditLoading(true); setEditApiError(""); setEditSuccess("");
    try {
      const payload = { ...editForm, studentId: editForm.studentId.trim().toUpperCase() };
      await apiFetch(`${API_BASE}/api/students/${editStudent.studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      setEditSuccess("Student updated successfully!");
      const updated = students.map(s =>
        s.studentId === editStudent.studentId ? { ...s, ...payload } : s
      );
      setStudents(updated);
      studentsCache = updated;
    } catch (e) { setEditApiError(e.message); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`${API_BASE}/api/students/${confirmDelete.studentId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
      });
      const updated = students.filter(s => s.studentId !== confirmDelete.studentId);
      setStudents(updated);
      studentsCache = updated;
      setConfirmDelete(null);
    } catch (e) { alert(e.message); setConfirmDelete(null); }
    finally { setDeleteLoading(false); }
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
            <h1 className="pg-page-title">All Students</h1>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-topbar-btn" onClick={fetchStudents}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="pg-content">

          {/* ── Filters ── */}
          <div className="pg-filters">
            <div className="pg-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="pg-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="pg-search" placeholder="Search by name, ID or email…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="pg-search-clear" onClick={() => setSearch("")}>×</button>}
            </div>
            <select className="pg-select" value={progFilter} onChange={e => setProgFilter(e.target.value)}>
              {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="pg-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {/* FIX: explicit value={y} on each option so the filter comparison works */}
            <select className="pg-select" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
              {YEARS.map(y => (
                <option key={y} value={y}>{y === "All Years" ? y : `Year ${y}`}</option>
              ))}
            </select>
          </div>

          {/* ── Toolbar: count + per-page selector ── */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.75rem" }}>
            <p className="pg-count" style={{ margin:0 }}>
              {filtered.length} student{filtered.length !== 1 ? "s" : ""} found
              {filtered.length !== students.length ? ` (${students.length} total)` : ""}
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:"0.25rem", flexWrap:"wrap" }}>
              <span style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginRight:"0.2rem" }}>Show:</span>
              {PAGE_SIZES.map(n => (
                <button key={n}
                  onClick={() => handlePageSizeChange(n)}
                  style={{
                    padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px",
                    background: pageSize === n && !showCustom ? "var(--accent)" : "transparent",
                    color: pageSize === n && !showCustom ? "#fff" : "var(--text-secondary)",
                    fontSize:"0.72rem", cursor:"pointer", transition:"all .15s",
                  }}>{n}</button>
              ))}
              <button
                onClick={() => handlePageSizeChange("custom")}
                style={{
                  padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px",
                  background: showCustom ? "var(--accent)" : "transparent",
                  color: showCustom ? "#fff" : "var(--text-secondary)",
                  fontSize:"0.72rem", cursor:"pointer",
                }}>Custom</button>
              {showCustom && (
                <span style={{ display:"flex", alignItems:"center", gap:"0.25rem", marginLeft:"0.2rem" }}>
                  <input type="number" min="1" max="10000" value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && applyCustomSize()}
                    placeholder="e.g. 75"
                    style={{ width:"68px", padding:"0.22rem 0.4rem", border:"1px solid var(--border)", borderRadius:"6px", fontSize:"0.72rem", background:"var(--surface)", color:"var(--text-primary)" }} />
                  <button onClick={applyCustomSize}
                    style={{ padding:"0.22rem 0.5rem", borderRadius:"6px", border:"1px solid var(--accent)", background:"var(--accent)", color:"#fff", fontSize:"0.72rem", cursor:"pointer" }}>Go</button>
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="pg-alert pg-alert--error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ flex: 1 }}>{error}</span>
              <button className="pg-retry-btn" onClick={fetchStudents}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="pg-loading"><div className="pg-spinner"/><span>Loading students…</span></div>
          ) : (
            <>
              <div className="pg-table-card">
                <div className="pg-table-wrap">
                  <table className="pg-table">
                    <thead>
                      <tr><th>Photo</th><th>Name</th><th>Student ID</th><th>Program</th><th>Year</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr><td colSpan={7} className="pg-empty">No students found</td></tr>
                      ) : paginated.map(s => (
                        <tr key={s.studentId}>
                          <td>
                            {s.imageLink
                              ? <img src={s.imageLink} alt={s.name} className="pg-avatar" onError={e => { e.target.style.display="none"; }}/>
                              : <div className="pg-avatar-ph"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/></svg></div>
                            }
                          </td>
                          <td><p className="pg-cell-primary">{s.name}</p><p className="pg-cell-sub">{s.email}</p></td>
                          <td className="pg-cell-mono">{s.studentId}</td>
                          <td><p className="pg-cell-primary">{s.program}</p><p className="pg-cell-sub">{s.department}</p></td>
                          <td className="pg-cell-sub">Year {s.year}</td>
                          <td><span className={`pg-badge pg-badge--${s.status}`}>{s.status}</span></td>
                          <td>
                            <div className="pg-actions">
                              <button className="pg-btn pg-btn--edit" onClick={() => openEdit(s)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                Edit
                              </button>
                              <button className="pg-btn pg-btn--delete" onClick={() => setConfirmDelete(s)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                                </svg>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Pagination bar ── */}
              {totalPages > 1 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"1rem", paddingTop:"0.75rem", borderTop:"1px solid var(--border)", flexWrap:"wrap", gap:"0.5rem" }}>
                  <span style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>
                    {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <div style={{ display:"flex", gap:"0.2rem", flexWrap:"wrap", alignItems:"center" }}>
                    {[
                      { label:"«", action:() => setCurrentPage(1),          dis: safePage===1 },
                      { label:"‹", action:() => setCurrentPage(p=>Math.max(1,p-1)), dis: safePage===1 },
                    ].map(({label,action,dis}) => (
                      <button key={label} onClick={action} disabled={dis}
                        style={{ padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-secondary)", fontSize:"0.75rem", cursor:"pointer", opacity:dis?0.35:1 }}>{label}</button>
                    ))}
                    {getPageNumbers().map((p, i) =>
                      p === "..." ? <span key={`e${i}`} style={{ padding:"0 0.2rem", color:"var(--text-muted)", fontSize:"0.75rem" }}>…</span>
                      : <button key={p} onClick={() => setCurrentPage(p)}
                          style={{ padding:"0.22rem 0.55rem", border:`1px solid ${safePage===p?"var(--accent)":"var(--border)"}`, borderRadius:"6px",
                            background:safePage===p?"var(--accent)":"transparent", color:safePage===p?"#fff":"var(--text-secondary)",
                            fontSize:"0.75rem", cursor:"pointer", fontWeight:safePage===p?600:400, minWidth:"30px" }}>{p}</button>
                    )}
                    {[
                      { label:"›", action:() => setCurrentPage(p=>Math.min(totalPages,p+1)), dis: safePage===totalPages },
                      { label:"»", action:() => setCurrentPage(totalPages),                  dis: safePage===totalPages },
                    ].map(({label,action,dis}) => (
                      <button key={label} onClick={action} disabled={dis}
                        style={{ padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-secondary)", fontSize:"0.75rem", cursor:"pointer", opacity:dis?0.35:1 }}>{label}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ══ Edit Modal ══ */}
        {editStudent && (
          <div className="pg-modal-backdrop" onClick={closeEdit}>
            <div className="pg-modal" onClick={e => e.stopPropagation()}>
              <div className="pg-modal-header">
                <h2 className="pg-modal-title">Edit Student</h2>
                <button className="pg-modal-close" onClick={closeEdit}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              {editSuccess && (
                <div className="pg-alert pg-alert--success" style={{ margin:"0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {editSuccess}
                </div>
              )}
              {editApiError && (
                <div className="pg-alert pg-alert--error" style={{ margin:"0 1.5rem 0.5rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {editApiError}
                </div>
              )}
              <div className="pg-modal-body">
                <div className="pg-form-grid">
                  <div className="pg-field">
                    <label className="pg-label">Full Name *</label>
                    <input name="name" value={editForm.name||""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.name?" pg-input--error":""}`}/>
                    {editErrors.name && <p className="pg-field-error">{editErrors.name}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Email *</label>
                    <input name="email" type="email" value={editForm.email||""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.email?" pg-input--error":""}`}/>
                    {editErrors.email && <p className="pg-field-error">{editErrors.email}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Phone</label>
                    <input name="phone" value={editForm.phone||""} onChange={handleEditChange} autoComplete="off" className="pg-input"/>
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Student ID *</label>
                    <input name="studentId" value={editForm.studentId||""} onChange={handleEditChange} autoComplete="off"
                      placeholder="e.g. NSE202601 or EE-2024-01"
                      style={{ textTransform:"uppercase", fontFamily:"monospace", letterSpacing:"0.04em" }}
                      className={`pg-input${editErrors.studentId?" pg-input--error":""}`}/>
                    {editErrors.studentId
                      ? <p className="pg-field-error">{editErrors.studentId}</p>
                      : <p style={{ fontSize:"0.68rem", color:"var(--text-muted)", margin:0 }}>Any alphanumeric format</p>
                    }
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Program *</label>
                    <input name="program" value={editForm.program||""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.program?" pg-input--error":""}`}/>
                    {editErrors.program && <p className="pg-field-error">{editErrors.program}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Department *</label>
                    <input name="department" value={editForm.department||""} onChange={handleEditChange} autoComplete="off"
                      className={`pg-input${editErrors.department?" pg-input--error":""}`}/>
                    {editErrors.department && <p className="pg-field-error">{editErrors.department}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Image URL</label>
                    <input name="imageLink" value={editForm.imageLink||""} onChange={handleEditChange} autoComplete="off"
                      placeholder="https://…" className="pg-input"/>
                  </div>
                </div>
                <div className="pg-form-grid" style={{ marginTop:"0.75rem" }}>
                  <div className="pg-field">
                    <label className="pg-label">Academic Year *</label>
                    <select name="year" value={editForm.year||"1"} onChange={handleEditChange} className="pg-input pg-select-input">
                      {[1,2,3,4,5,6,7,8,9,10].map(y => (
                        <option key={y} value={y}>{y}{y===1?"st":y===2?"nd":y===3?"rd":"th"} Year</option>
                      ))}
                    </select>
                    {editErrors.year && <p className="pg-field-error">{editErrors.year}</p>}
                  </div>
                  <div className="pg-field">
                    <label className="pg-label">Status</label>
                    <select name="status" value={editForm.status||"active"} onChange={handleEditChange} className="pg-input pg-select-input">
                      {["active","suspended","graduated"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="pg-modal-footer">
                <button className="pg-modal-btn pg-modal-btn--cancel" onClick={closeEdit}>Cancel</button>
                <button className="pg-modal-btn pg-modal-btn--confirm" onClick={submitEdit} disabled={editLoading}>
                  {editLoading ? <><span className="pg-btn-spinner"/>Saving…</> : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={!!confirmDelete}
          title="Delete Student"
          message={`Are you sure you want to delete "${confirmDelete?.name}" (${confirmDelete?.studentId})? This action cannot be undone.`}
          confirmLabel={deleteLoading ? "Deleting…" : "Delete"}
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </main>
    </div>
  );
};

export default AllStudents;