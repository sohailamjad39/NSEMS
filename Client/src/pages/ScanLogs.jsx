/**
 * Client/src/pages/ScanLogs.jsx
 * Light theme. Robust error handling.
 *
 * ADDED:
 *  - Pagination: 10/20/50/100/custom per page with page-number controls.
 *  - Module-level cache keyed by dateFilter — no re-fetch on navigation.
 *  - Offline fallback via offlineService IndexedDB.
 *  - Existing filters (status, date) and search unchanged.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import API_BASE from "../config/api";
import AdminSidebar from "../components/AdminSidebar";
import { offlineService } from "../services/offlineService";

const STATUSES  = ["All Statuses","valid","invalid","expired"];
const PAGE_SIZES = [10, 20, 50, 100];

// Module-level cache keyed by dateFilter ('today' | 'all')
const logsCache = {};

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

const ScanLogs = () => {
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  // Filters
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [dateFilter,   setDateFilter]   = useState("today");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize,    setPageSize]    = useState(20);
  const [customSize,  setCustomSize]  = useState("");
  const [showCustom,  setShowCustom]  = useState(false);

  const navigate     = useNavigate();
  const isMountedRef = useRef(true);

  // helpers for IndexedDB per-key
  const idbSave = (df, list) => df === "today"
    ? offlineService.cacheScanLogs(list).catch(() => {})
    : offlineService.cacheScanLogsAll(list).catch(() => {});
  const idbLoad = (df) => df === "today"
    ? offlineService.getCachedScanLogs()
    : offlineService.getCachedScanLogsAll();

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
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, dateFilter]);

  // Reset page on filter/search/pageSize change
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, pageSize]);

  // ── Cache-first load ──────────────────────────────────────────────────────
  const loadLogs = async () => {
    if (logsCache[dateFilter]) {
      setLogs(logsCache[dateFilter]);
      setLoading(false);
      return;
    }
    setLoading(true); setError("");
    if (!navigator.onLine) {
      try {
        const cached = await idbLoad(dateFilter);
        if (cached?.logs?.length > 0) { logsCache[dateFilter] = cached.logs; setLogs(cached.logs); }
        else setError("You are offline and no cached scan logs are available.");
      } catch { setError("Failed to load offline data."); }
      if (isMountedRef.current) setLoading(false);
      return;
    }
    try {
      const today = dateFilter === "today" ? "true" : "false";
      const data  = await apiFetch(`${API_BASE}/api/scanner/logs?today=${today}&limit=500`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.logs || [];
      logsCache[dateFilter] = list;
      setLogs(list);
      idbSave(dateFilter, list);
    } catch (e) {
      setError(e.message);
      try {
        const cached = await idbLoad(dateFilter);
        if (cached?.logs?.length > 0) { logsCache[dateFilter] = cached.logs; setLogs(cached.logs); setError(""); }
      } catch { /* keep error */ }
    } finally { if (isMountedRef.current) setLoading(false); }
  };

  // Refresh — always hits network
  const fetchLogs = async () => {
    setLoading(true); setError("");
    try {
      const today = dateFilter === "today" ? "true" : "false";
      const data  = await apiFetch(`${API_BASE}/api/scanner/logs?today=${today}&limit=500`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const list = data.logs || [];
      logsCache[dateFilter] = list;
      setLogs(list);
      setCurrentPage(1);
      idbSave(dateFilter, list);
    } catch (e) { setError(e.message); }
    finally { if (isMountedRef.current) setLoading(false); }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || l.studentId?.toLowerCase().includes(q)
      || l.studentName?.toLowerCase().includes(q)
      || l.scannerId?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "All Statuses" || l.validationStatus === statusFilter;
    return matchSearch && matchStatus;
  }), [logs, search, statusFilter]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handlePageSizeChange = (val) => {
    if (val === "custom") { setShowCustom(true); return; }
    setShowCustom(false); setPageSize(Number(val)); setCurrentPage(1);
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

  // Summary counts (across ALL logs, not just current page)
  const statsValid   = logs.filter(l => l.validationStatus === "valid").length;
  const statsInvalid = logs.filter(l => l.validationStatus === "invalid").length;
  const statsExpired = logs.filter(l => l.validationStatus === "expired").length;

  const btnStyle = (active) => ({
    padding:"0.22rem 0.55rem", border:`1px solid ${active?"var(--accent)":"var(--border)"}`,
    borderRadius:"6px", background:active?"var(--accent)":"transparent",
    color:active?"#fff":"var(--text-secondary)", fontSize:"0.72rem", cursor:"pointer", transition:"all .15s",
  });

  return (
    <div className="ad-layout">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className="ad-main">

        <div className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <span/><span/><span/>
            </button>
            <h1 className="pg-page-title">Scan Logs</h1>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-topbar-btn" onClick={fetchLogs}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="pg-content">

          {/* ── Summary cards ── */}
          <div className="pg-summary">
            {[
              { label:"Valid",   value:statsValid,   cls:"valid" },
              { label:"Invalid", value:statsInvalid, cls:"invalid" },
              { label:"Expired", value:statsExpired, cls:"expired" },
              { label:"Total",   value:logs.length,  cls:"total" },
            ].map(({label,value,cls}) => (
              <div key={cls} className={`pg-summary-card pg-summary-card--${cls}`}>
                <p className="pg-summary-num">{value}</p>
                <p className="pg-summary-label">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Filters ── */}
          <div className="pg-filters">
            <div className="pg-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="pg-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="pg-search" placeholder="Search by student ID, name or scanner…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="pg-search-clear" onClick={() => setSearch("")}>×</button>}
            </div>
            <select className="pg-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="pg-select" value={dateFilter} onChange={e => { setDateFilter(e.target.value); setCurrentPage(1); }}>
              <option value="today">Today</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* ── Toolbar: count + per-page ── */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.75rem" }}>
            <p className="pg-count" style={{ margin:0 }}>
              {filtered.length} log{filtered.length !== 1 ? "s" : ""} found
              {filtered.length !== logs.length ? ` (${logs.length} total)` : ""}
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:"0.25rem", flexWrap:"wrap" }}>
              <span style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginRight:"0.2rem" }}>Show:</span>
              {PAGE_SIZES.map(n => (
                <button key={n} onClick={() => handlePageSizeChange(n)} style={btnStyle(pageSize===n && !showCustom)}>{n}</button>
              ))}
              <button onClick={() => handlePageSizeChange("custom")} style={btnStyle(showCustom)}>Custom</button>
              {showCustom && (
                <span style={{ display:"flex", alignItems:"center", gap:"0.25rem", marginLeft:"0.2rem" }}>
                  <input type="number" min="1" value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && applyCustomSize()}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" style={{flexShrink:0}}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{flex:1}}>{error}</span>
              <button className="pg-retry-btn" onClick={fetchLogs}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="pg-loading"><div className="pg-spinner"/><span>Loading scan logs…</span></div>
          ) : (
            <>
              <div className="pg-table-card">
                <div className="pg-table-wrap">
                  <table className="pg-table">
                    <thead>
                      <tr>
                        <th>Student ID</th><th>Student Name</th><th>Scanner</th>
                        <th>Status</th><th>Time</th><th>Validation (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr><td colSpan={6} className="pg-empty">No scan logs found</td></tr>
                      ) : paginated.map((log, i) => (
                        <tr key={i}>
                          <td className="pg-cell-mono">{log.studentId || "—"}</td>
                          <td className="pg-cell-primary">{log.studentName || "Unknown"}</td>
                          <td className="pg-cell-sub">{log.scannerId || "—"}</td>
                          <td>
                            <span className={`pg-badge pg-badge--${
                              log.validationStatus==="valid" ? "active" :
                              log.validationStatus==="expired" ? "graduated" : "suspended"
                            }`}>{log.validationStatus}</span>
                          </td>
                          <td className="pg-cell-sub">
                            {log.timestamp ? new Date(log.timestamp).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}
                          </td>
                          <td className="pg-cell-sub">{log.validationTime ?? "—"}</td>
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
                    {(safePage-1)*pageSize+1}–{Math.min(safePage*pageSize, filtered.length)} of {filtered.length}
                  </span>
                  <div style={{ display:"flex", gap:"0.2rem", flexWrap:"wrap", alignItems:"center" }}>
                    {[{label:"«",act:()=>setCurrentPage(1),dis:safePage===1},{label:"‹",act:()=>setCurrentPage(p=>Math.max(1,p-1)),dis:safePage===1}]
                      .map(({label,act,dis}) => (
                        <button key={label} onClick={act} disabled={dis}
                          style={{ padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-secondary)", fontSize:"0.75rem", cursor:"pointer", opacity:dis?0.35:1 }}>{label}</button>
                    ))}
                    {getPageNumbers().map((p,i) =>
                      p==="..." ? <span key={`e${i}`} style={{ padding:"0 0.2rem", color:"var(--text-muted)", fontSize:"0.75rem" }}>…</span>
                      : <button key={p} onClick={()=>setCurrentPage(p)}
                          style={{ padding:"0.22rem 0.55rem", border:`1px solid ${safePage===p?"var(--accent)":"var(--border)"}`, borderRadius:"6px",
                            background:safePage===p?"var(--accent)":"transparent", color:safePage===p?"#fff":"var(--text-secondary)",
                            fontSize:"0.75rem", cursor:"pointer", fontWeight:safePage===p?600:400, minWidth:"30px" }}>{p}</button>
                    )}
                    {[{label:"›",act:()=>setCurrentPage(p=>Math.min(totalPages,p+1)),dis:safePage===totalPages},{label:"»",act:()=>setCurrentPage(totalPages),dis:safePage===totalPages}]
                      .map(({label,act,dis}) => (
                        <button key={label} onClick={act} disabled={dis}
                          style={{ padding:"0.22rem 0.55rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-secondary)", fontSize:"0.75rem", cursor:"pointer", opacity:dis?0.35:1 }}>{label}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScanLogs;