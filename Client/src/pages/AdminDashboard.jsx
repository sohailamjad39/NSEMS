/**
 * Client/src/pages/AdminDashboard.jsx
 *
 * FIXES (existing logic otherwise untouched):
 *
 * FIX 1 — Random error sound on button clicks:
 *   The previous unlock used errorAudioRef.current.play() → .pause().
 *   On short audio files the pause arrives after the sound already played —
 *   causing random audible beeps on any click anywhere on the page.
 *   Fixed: AudioContext.resume() + 0-gain oscillator unlocks the audio engine
 *   with zero audible output. error.mp3 only plays in playErrorSound().
 *
 * FIX 2 — Expired QR codes not logged to MongoDB / not visible in ScanLogs:
 *   The old handler returned early for expired QRs before calling the server:
 *     if (Math.abs(currentTimeWindow - timeWindow) > 1) { ... return; }
 *   The server's validateQR() is the ONLY place ScanLog.create() runs, so
 *   those expired scans were never stored in MongoDB.
 *   Fixed: removed the client-side early return. ALL QR data (valid, invalid,
 *   expired) now goes to /api/scanner/validate when online. The server already
 *   handles expiry correctly and creates the ScanLog record each time.
 *   Offline path retains local expiry check since the server is unreachable.
 */

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/library";
import API_BASE from "../config/api";
import { offlineService } from "../services/offlineService";
import AdminSidebar from "../components/AdminSidebar";

const AdminDashboard = () => {
  const [scannedStudent, setScannedStudent] = useState(null);
  const [cameraError,    setCameraError]    = useState(null);
  const [isScanning,     setIsScanning]     = useState(true);
  const [scanHistory,    setScanHistory]    = useState([]);
  const [isOnline,       setIsOnline]       = useState(navigator.onLine);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const [isLogsLoading,  setIsLogsLoading]  = useState(false);
  // Scan history pagination
  const [logsPage,     setLogsPage]     = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(10);
  const [logsSearch,   setLogsSearch]   = useState("");

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalAdmins:   0,
    todayTotal:    0,
    todayValid:    0,
    todayInvalid:  0,
  });

  const videoRef     = useRef(null);
  const scannerRef   = useRef(null);
  const streamRef    = useRef(null);
  const navigate     = useNavigate();
  const isMountedRef = useRef(true);

  const lastScannedQR = useRef(null);
  const lastScanTime  = useRef(0);

  // ── Audio (FIX 1) ────────────────────────────────────────────────────────
  const errorAudioRef    = useRef(null);
  const audioCtxRef      = useRef(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    errorAudioRef.current = new Audio("/error.mp3");
    errorAudioRef.current.preload = "auto";

    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        // Resume with a 0-gain oscillator — completely silent, satisfies autoplay policy
        if (ctx.state === "suspended") {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(0);
          osc.stop(0.001);
          ctx.resume().catch(() => {});
        }
        audioUnlockedRef.current = true;
      } catch (_) { /* ignore */ }

      document.removeEventListener("click",      unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("keydown",    unlockAudio);
    };

    document.addEventListener("click",      unlockAudio, { passive: true });
    document.addEventListener("touchstart", unlockAudio, { passive: true });
    document.addEventListener("keydown",    unlockAudio, { passive: true });

    return () => {
      document.removeEventListener("click",      unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
      document.removeEventListener("keydown",    unlockAudio);
    };
  }, []);

  const playErrorSound = () => {
    try {
      if (!errorAudioRef.current) return;
      errorAudioRef.current.currentTime = 0;
      errorAudioRef.current.play().catch(() => {});
    } catch (_) { /* ignore */ }
  };

  const adminName = localStorage.getItem("adminName") || "Administrator";

  // ── Resize / scroll lock ─────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  // ── Online / offline ─────────────────────────────────────────────────────
  useEffect(() => {
    const up = () => {
      setIsOnline(true);
      offlineService.syncOfflineScanLogs()
        .then((count) => { if (count > 0) console.log(`Synced ${count} offline logs`); })
        .catch(() => {});
    };
    const down = () => setIsOnline(false);
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  // ── Scanner format config ────────────────────────────────────────────────
  useEffect(() => {
    if (!isScanning || !videoRef.current) return;
    const hints = new Map();
    hints.set("POSSIBLE_FORMATS", [BarcodeFormat.QR_CODE, BarcodeFormat.AZTEC, BarcodeFormat.DATA_MATRIX]);
    const scanner = new BrowserMultiFormatReader(hints);
    scanner.timeBetweenDecodingAttempts = 100;
    scanner.decodeFromVideoDevice(null, videoRef.current, (result) => {
      if (result) handleQRScan(result.text);
    });
    scannerRef.current = scanner;
    return () => { if (scannerRef.current) { scannerRef.current.reset(); scannerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  // ── Auth + init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken(), role = getRole();
    if (!token || (role !== "admin" && role !== "scanner")) { removeToken(); navigate("/"); return; }
    initCameraScanner();
    syncStudentsForOffline();
    fetchDashboardStats();
    fetchScanLogsFromDB();
    return () => { isMountedRef.current = false; cleanupScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const fetchDashboardStats = async () => {
    try {
      const cached = await offlineService.getDashboardStats();
      if (cached) {
        setStats((prev) => ({
          ...prev,
          totalStudents: cached.totalStudents ?? prev.totalStudents,
          totalAdmins:   cached.totalAdmins   ?? prev.totalAdmins,
        }));
      }
      if (!navigator.onLine) return;
      const token    = getToken();
      const statsRes = await fetch(`${API_BASE}/api/students/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats((prev) => ({
            ...prev,
            totalStudents: statsData.totalStudents,
            totalAdmins:   statsData.totalAdmins,
          }));
          const current = (await offlineService.getDashboardStats()) || {};
          offlineService.storeDashboardStats({
            ...current,
            totalStudents: statsData.totalStudents,
            totalAdmins:   statsData.totalAdmins,
          }).catch(() => {});
        }
      }
    } catch (e) { console.warn("fetchDashboardStats error:", e); }
  };

  // ── Scan logs from DB ────────────────────────────────────────────────────
  const fetchScanLogsFromDB = async () => {
    if (!navigator.onLine) return;
    try {
      setIsLogsLoading(true);
      const token = getToken();
      const res   = await fetch(`${API_BASE}/api/scanner/logs?today=true&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const dbLogs = (data.logs || []).map((l) => ({
            studentId: l.studentId || "—",
            name:      l.studentName || "Unknown",
            status:    l.validationStatus === "valid" ? "verified" : l.validationStatus,
            timestamp: l.timestamp ? new Date(l.timestamp).getTime() : Date.now(),
          }));
          setScanHistory((prev) => {
            const existingTs = new Set(prev.map((p) => p.timestamp));
            const newEntries = dbLogs.filter((d) => !existingTs.has(d.timestamp));
            return [...prev, ...newEntries].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
          });
          setStats((prev) => ({
            ...prev,
            todayTotal:   data.todayTotal   ?? prev.todayTotal,
            todayValid:   data.todayValid   ?? prev.todayValid,
            todayInvalid: data.todayInvalid ?? prev.todayInvalid,
          }));
        }
      }
    } catch (e) { console.warn("fetchScanLogsFromDB error:", e); }
    finally { if (isMountedRef.current) setIsLogsLoading(false); }
  };

  // ── Sync ─────────────────────────────────────────────────────────────────
  const syncStudentsForOffline = async () => {
    try {
      const cached = await offlineService.getAllStudents();
      if (cached.length > 0) console.log("✅ Using cached students:", cached.length);
      if (navigator.onLine) { console.log("🔄 Syncing students..."); await offlineService.syncAllStudents(); }
    } catch (e) { console.warn("Sync failed:", e); }
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (navigator.onLine) {
        await syncStudentsForOffline();
        const synced = await offlineService.syncOfflineScanLogs();
        if (synced > 0) console.log(`Synced ${synced} offline logs`);
        await fetchDashboardStats();
        await fetchScanLogsFromDB();
      } else { console.warn("Sync Now clicked but offline"); }
    } catch (e) { console.warn("Sync Now error:", e); }
    finally { if (isMountedRef.current) setIsSyncing(false); }
  };

  // ── Camera ───────────────────────────────────────────────────────────────
  const initCameraScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 }, aspectRatio: { ideal: 1.7777777778 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current && isMountedRef.current) {
        videoRef.current.srcObject = stream;
        const p = videoRef.current.play();
        if (p !== undefined) {
          p.then(() => {
            if (!isMountedRef.current) return;
            const hints = new Map();
            hints.set("POSSIBLE_FORMATS", [BarcodeFormat.QR_CODE, BarcodeFormat.AZTEC, BarcodeFormat.DATA_MATRIX]);
            const scanner = new BrowserMultiFormatReader(hints);
            scanner.timeBetweenDecodingAttempts = 100;
            scanner.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
              if (result?.text && isScanning && isMountedRef.current) handleQRScan(result.text);
            });
            scannerRef.current = scanner;
            setCameraError(null);
          }).catch(() => {
            if (!isMountedRef.current) return;
            setCameraError("Failed to start camera. Please check permissions and try again.");
          });
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      let msg = "Camera permission required";
      if      (err.name === "NotAllowedError")  msg = "Camera access denied. Please allow camera permissions.";
      else if (err.name === "NotFoundError")    msg = "No camera found on this device.";
      else if (err.name === "NotReadableError") msg = "Camera is already in use by another application.";
      setCameraError(msg);
    }
  };

  // ── QR scan handler (FIX 2) ──────────────────────────────────────────────
  //
  // When ONLINE: all QR codes reach /api/scanner/validate so the server can
  // create a ScanLog record (valid, invalid, AND expired). The server already
  // handles every case and returns the correct response.
  //
  // When OFFLINE: use offlineService.validateQROffline() which checks expiry
  // locally (server is unreachable so we have no other option).
  //
  const handleQRScan = async (qrData) => {
    const now = Date.now();
    if (lastScannedQR.current === qrData && now - lastScanTime.current < 2000) return;
    lastScannedQR.current = qrData;
    lastScanTime.current  = now;

    try {
      const parts = qrData.trim().split("|");
      if (parts.length !== 3) {
        setScannedStudent({ error: "Invalid QR format", type: "error" });
        playErrorSound();
        return;
      }

      const [studentId] = parts;
      let validationResult = null;

      if (!navigator.onLine) {
        // ── OFFLINE path ─────────────────────────────────────────────────
        validationResult = await offlineService.validateQROffline(qrData);
        if (!validationResult?.valid) {
          const isExp = validationResult?.message?.toLowerCase().includes("expired");
          offlineService.queueOfflineScanLog({
            studentId, status: isExp ? "expired" : "invalid", timestamp: now,
          }).catch(() => {});
        }
      } else {
        // ── ONLINE path: always call server (FIX 2) ──────────────────────
        try {
          const res = await fetch(`${API_BASE}/api/scanner/validate`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ qrData, scannerId: "admin-" + Date.now() }),
          });
          const serverData = await res.json();
          if (serverData.success !== undefined) {
            validationResult = serverData;
            if (serverData.valid && serverData.student) {
              offlineService.storeStudentData({
                studentId:  serverData.student.id,
                name:       serverData.student.name,
                secretKey:  serverData.student.secretKey,
                program:    serverData.student.program,
                department: serverData.student.department,
                year:       serverData.student.year,
                status:     serverData.student.status,
                imageLink:  serverData.student.imageLink || "",
              }).catch(() => {});
            }
          }
        } catch (serverError) {
          // Network dropped mid-scan — fall back offline
          console.warn("Server unreachable, falling back offline:", serverError);
          validationResult = await offlineService.validateQROffline(qrData);
          if (!validationResult?.valid) {
            const isExp = validationResult?.message?.toLowerCase().includes("expired");
            offlineService.queueOfflineScanLog({
              studentId, status: isExp ? "expired" : "invalid", timestamp: now,
            }).catch(() => {});
          }
        }
      }

      if (validationResult?.success && validationResult?.valid) {
        const student = validationResult.student;
        let displayImage = student.imageLink || "";
        if (!displayImage) {
          const cached = await offlineService.getStudentImage(student.id);
          if (cached) displayImage = cached;
        }
        setScannedStudent({
          success:   true,
          student:   { ...student, imageLink: displayImage },
          timestamp: validationResult.timestamp || now,
        });
        addToHistory({ studentId: student.id, name: student.name, image: displayImage, status: "verified", timestamp: validationResult.timestamp || now });
        setStats((prev) => ({ ...prev, todayTotal: prev.todayTotal + 1, todayValid: prev.todayValid + 1 }));
      } else {
        playErrorSound(); // plays for invalid AND expired
        const isExpired = validationResult?.message?.toLowerCase().includes("expired");
        setScannedStudent({
          error:     validationResult?.message || "Invalid QR code",
          type:      isExpired ? "warning" : "error",
          studentId,
          ...(isExpired && validationResult?.expiresAt ? { expiresAt: validationResult.expiresAt } : {}),
        });
        addToHistory({ studentId, status: isExpired ? "expired" : "invalid", timestamp: now });
        setStats((prev) => ({ ...prev, todayTotal: prev.todayTotal + 1, todayInvalid: prev.todayInvalid + 1 }));
        setTimeout(() => { if (isMountedRef.current) setScannedStudent(null); }, 2500);
      }
    } catch (error) {
      console.error("QR validation error:", error);
      if (isMountedRef.current) {
        playErrorSound();
        setScannedStudent({ error: "Validation failed", type: "error" });
        setTimeout(() => { if (isMountedRef.current) setScannedStudent(null); }, 2500);
      }
    }
  };

  const addToHistory = (scan) => {
    if (!isMountedRef.current) return;
    setScanHistory((prev) => [scan, ...prev].slice(0, 50));
  };

  const cleanupScanner = () => {
    if (scannerRef.current) { try { scannerRef.current.reset(); } catch (_) {} scannerRef.current = null; }
    if (streamRef.current)  { streamRef.current.getTracks().forEach((t) => { if (t.readyState === "live") t.stop(); }); streamRef.current = null; }
    if (videoRef.current)   { videoRef.current.srcObject = null; videoRef.current.load(); }
  };

  const handleDismissScan = () => setScannedStudent(null);

  const verifiedCount = stats.todayValid   || scanHistory.filter((s) => s.status === "verified").length;
  const invalidCount  = stats.todayInvalid || scanHistory.filter((s) => s.status === "invalid" || s.status === "expired").length;
  const totalToday    = stats.todayTotal   || scanHistory.length;

  if (cameraError) {
    return (
      <div className="ad-layout">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onCleanup={cleanupScanner} />
        <main className="ad-main">
          <div className="ad-topbar">
            <div className="ad-topbar-left">
              <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><span /><span /><span /></button>
            </div>
          </div>
          <div className="ad-camera-error-wrap">
            <div className="ad-camera-error-card">
              <div className="ad-camera-error-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <h2 className="ad-camera-error-title">Camera Access Required</h2>
              <p className="ad-camera-error-msg">{cameraError}</p>
              <button className="ad-camera-retry-btn" onClick={() => window.location.reload()}>Retry Camera Access</button>
              <button className="ad-camera-logout-btn" onClick={() => { removeToken(); cleanupScanner(); navigate("/"); }}>Logout</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ad-layout">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onCleanup={cleanupScanner} />
      <main className="ad-main">
        <div className="ad-topbar">
          <div className="ad-topbar-left">
            <button className="ad-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu"><span /><span /><span /></button>
            <button className="ad-topbar-btn" onClick={() => { const online = navigator.onLine; setIsOnline(online); if (online) handleSyncNow(); }} title={isOnline ? "Connected — click to sync" : "Offline"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {isOnline ? "Online" : "Offline"}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <div className="ad-topbar-right">
            <button className="ad-topbar-btn" onClick={handleSyncNow} disabled={isSyncing} title="Sync students & upload offline scan logs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" style={isSyncing ? { animation: "ad-spin-icon 0.8s linear infinite" } : {}}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {isSyncing ? "Syncing…" : "Sync Now"}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className={`ad-status-badge ${isOnline ? "ad-status-badge--online" : "ad-status-badge--offline"}`}>
              <span className="ad-status-dot" /><span className="ad-status-label">{isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>

        <div className="ad-content-grid">
          <div className="ad-scanner-col">
            <div className="ad-scanner-card">
              <div className="ad-scanner-card-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/></svg>
                QR Code Scanner
              </div>
              <div className="ad-camera-wrap">
                <video ref={videoRef} muted playsInline autoPlay className="ad-camera-video" />
                <div className="ad-camera-overlay">
                  <div className="ad-scan-frame">
                    <span className="ad-scan-corner ad-scan-corner--tl" /><span className="ad-scan-corner ad-scan-corner--tr" />
                    <span className="ad-scan-corner ad-scan-corner--bl" /><span className="ad-scan-corner ad-scan-corner--br" />
                  </div>
                  <div className={`ad-scan-dot${isScanning ? " ad-scan-dot--active" : ""}`} />
                </div>
                <div className="ad-camera-label">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.94a7.5 7.5 0 0 0-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96a7.4 7.4 0 0 0-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.23-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.21c-.11.2-.06.47.12.61l2.03 1.58c-.04.3-.07.63-.07.94s.03.64.07.94L2.86 13.86c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.23.41.47.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.07.47 0 .59-.22l1.92-3.32c.12-.2.07-.47-.12-.61l-2.01-1.58z"/></svg>
                  SCAN QR CODE
                </div>
              </div>
              <div className="ad-scan-result">
                {scannedStudent?.success ? (
                  <div className="ad-result-valid">
                    <button className="ad-result-dismiss" onClick={handleDismissScan} aria-label="Dismiss" title="Dismiss">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div className="ad-result-student-row">
                      {scannedStudent.student?.imageLink ? (
                        <img src={scannedStudent.student.imageLink} alt={scannedStudent.student.name} className="ad-result-photo" onError={(e) => { e.target.style.display = "none"; }} />
                      ) : (
                        <div className="ad-result-photo-placeholder">
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                        </div>
                      )}
                      <div className="ad-result-student-info">
                        <p className="ad-result-student-name">{scannedStudent.student.name}</p>
                        <p className="ad-result-student-id">ID: {scannedStudent.student.id}</p>
                        <p className="ad-result-student-program">{scannedStudent.student.program || "BS Computer Science"}</p>
                      </div>
                    </div>
                    <div className="ad-result-status ad-result-status--valid">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
                      VALID
                    </div>
                    <p className="ad-result-meta">Scanned: {new Date(scannedStudent.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} by {adminName}</p>
                  </div>
                ) : scannedStudent?.error ? (
                  <div className="ad-result-invalid">
                    <div className={`ad-result-status ${scannedStudent.type === "warning" ? "ad-result-status--expired" : "ad-result-status--invalid"}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {scannedStudent.error.toUpperCase()}
                    </div>
                    {scannedStudent.studentId && <p className="ad-result-meta">ID: {scannedStudent.studentId}</p>}
                  </div>
                ) : (
                  <div className="ad-result-idle">
                    <p className="ad-result-idle-title">Ready to Scan</p>
                    <p className="ad-result-idle-sub">Point camera at student QR code</p>
                    <p className="ad-result-idle-hint">Works in any orientation &nbsp;•&nbsp; {isOnline ? "Online" : "Offline"} mode &nbsp;•&nbsp; Continuous scanning enabled</p>
                  </div>
                )}
              </div>
            </div>

            <div className="ad-stats-row">
              <div className="ad-stats-cell">
                <div className="ad-stats-cell-icon ad-stats-cell-icon--valid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg></div>
                <div><p className="ad-stats-cell-label">Scan Logs</p><p className="ad-stats-cell-value">Today: {verifiedCount}</p></div>
              </div>
              <div className="ad-stats-divider" />
              <div className="ad-stats-cell">
                <div className="ad-stats-cell-icon ad-stats-cell-icon--invalid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <div><p className="ad-stats-cell-label">Invalid Attempts</p><p className="ad-stats-cell-value">Today: {invalidCount}</p></div>
              </div>
              <div className="ad-stats-divider" />
              <div className="ad-stats-cell">
                <div><p className="ad-stats-cell-label">Total Today</p><p className="ad-stats-cell-value">Today: {totalToday}</p></div>
              </div>
            </div>

            <div className="ad-logs-card">
              <div className="ad-logs-header">
                <span className="ad-logs-title">Recent Scan Logs</span>
                <div style={{ display:"flex", alignItems:"center", gap:"0.35rem" }}>
                  {/* Per-page selector */}
                  {[10,20,50].map(n => (
                    <button key={n} onClick={() => { setLogsPageSize(n); setLogsPage(1); }}
                      style={{ padding:"0.15rem 0.4rem", border:`1px solid ${logsPageSize===n?"var(--accent)":"var(--border)"}`,
                        borderRadius:"5px", background:logsPageSize===n?"var(--accent)":"transparent",
                        color:logsPageSize===n?"#fff":"var(--text-muted)", fontSize:"0.65rem", cursor:"pointer" }}>{n}</button>
                  ))}
                  <button className="ad-logs-reload-btn" onClick={fetchScanLogsFromDB} disabled={isLogsLoading} title="Refresh scan logs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={isLogsLoading ? { animation: "ad-spin-icon 0.8s linear infinite" } : {}}>
                      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                  </button>
                </div>
              </div>
              {/* Search bar */}
              {scanHistory.length > 0 && (
                <div style={{ padding:"0.4rem 0.75rem 0", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                  <div style={{ position:"relative", flex:1 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"
                      style={{ position:"absolute", left:"0.5rem", top:"50%", transform:"translateY(-50%)", color:"var(--text-muted)", pointerEvents:"none" }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input value={logsSearch} onChange={e => { setLogsSearch(e.target.value); setLogsPage(1); }}
                      placeholder="Filter by ID or name…"
                      style={{ width:"100%", padding:"0.28rem 0.5rem 0.28rem 1.6rem", border:"1px solid var(--border)", borderRadius:"6px",
                        fontSize:"0.72rem", background:"var(--surface)", color:"var(--text-primary)", boxSizing:"border-box" }} />
                    {logsSearch && (
                      <button onClick={() => setLogsSearch("")}
                        style={{ position:"absolute", right:"0.4rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none",
                          color:"var(--text-muted)", cursor:"pointer", fontSize:"0.85rem", lineHeight:1 }}>×</button>
                    )}
                  </div>
                </div>
              )}
              {(() => {
                const filtered = scanHistory.filter(s => {
                  if (!logsSearch) return true;
                  const q = logsSearch.toLowerCase();
                  return s.studentId?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q);
                });
                const totalPgs = Math.max(1, Math.ceil(filtered.length / logsPageSize));
                const safePg   = Math.min(logsPage, totalPgs);
                const paged    = filtered.slice((safePg-1)*logsPageSize, safePg*logsPageSize);
                return scanHistory.length === 0 ? (
                  <div className="ad-logs-empty">{isLogsLoading ? "Loading…" : "No scans yet"}</div>
                ) : (
                  <>
                    <div className="ad-logs-table-wrap">
                      <table className="ad-logs-table">
                        <thead>
                          <tr>
                            <th>Student ID</th><th>Name</th><th>Status</th>
                            <th>Time <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10" style={{ marginLeft:"2px" }}><polyline points="18 15 12 9 6 15"/></svg></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paged.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign:"center", padding:"1rem", color:"var(--text-muted)", fontSize:"0.8rem" }}>No results</td></tr>
                          ) : paged.map((scan, index) => (
                            <tr key={index}>
                              <td className="ad-logs-id">{scan.studentId || "—"}</td>
                              <td className="ad-logs-name">{scan.name || "Unknown"}</td>
                              <td>
                                <span className={`ad-logs-badge ${scan.status === "verified" ? "ad-logs-badge--valid" : "ad-logs-badge--invalid"}`}>
                                  {scan.status === "verified"
                                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="9" height="9"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  }
                                  {scan.status === "verified" ? "VALID" : "INVALID"}
                                </span>
                              </td>
                              <td className="ad-logs-time">
                                {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPgs > 1 && (
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.4rem 0.75rem", borderTop:"1px solid var(--border)", flexWrap:"wrap", gap:"0.3rem" }}>
                        <span style={{ fontSize:"0.65rem", color:"var(--text-muted)" }}>
                          {(safePg-1)*logsPageSize+1}–{Math.min(safePg*logsPageSize,filtered.length)} / {filtered.length}
                        </span>
                        <div style={{ display:"flex", gap:"0.18rem" }}>
                          <button onClick={() => setLogsPage(p=>Math.max(1,p-1))} disabled={safePg===1}
                            style={{ padding:"0.15rem 0.45rem", border:"1px solid var(--border)", borderRadius:"5px", background:"transparent",
                              color:"var(--text-secondary)", fontSize:"0.7rem", cursor:"pointer", opacity:safePg===1?0.35:1 }}>‹</button>
                          {Array.from({length:totalPgs},(_, i)=>i+1).filter(p=>Math.abs(p-safePg)<=2||p===1||p===totalPgs).map((p,i,arr)=>
                            [i>0&&arr[i-1]<p-1&&<span key={`e${p}`} style={{padding:"0 0.15rem",color:"var(--text-muted)",fontSize:"0.7rem"}}>…</span>, (
                              <button key={p} onClick={()=>setLogsPage(p)}
                                style={{ padding:"0.15rem 0.45rem", border:`1px solid ${safePg===p?"var(--accent)":"var(--border)"}`, borderRadius:"5px",
                                  background:safePg===p?"var(--accent)":"transparent", color:safePg===p?"#fff":"var(--text-secondary)",
                                  fontSize:"0.7rem", cursor:"pointer", fontWeight:safePg===p?600:400 }}>{p}</button>
                            )]
                          )}
                          <button onClick={() => setLogsPage(p=>Math.min(totalPgs,p+1))} disabled={safePg===totalPgs}
                            style={{ padding:"0.15rem 0.45rem", border:"1px solid var(--border)", borderRadius:"5px", background:"transparent",
                              color:"var(--text-secondary)", fontSize:"0.7rem", cursor:"pointer", opacity:safePg===totalPgs?0.35:1 }}>›</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="ad-cards-col">
            <div className="ad-stat-card">
              <div className="ad-stat-card-icon ad-stat-card-icon--students">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              </div>
              <div><p className="ad-stat-card-label">All Students</p><p className="ad-stat-card-value">{stats.totalStudents > 0 ? `${stats.totalStudents} Students` : "Loading…"}</p></div>
            </div>
            <div className="ad-stat-card">
              <div className="ad-stat-card-icon ad-stat-card-icon--invalid">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
              </div>
              <div><p className="ad-stat-card-label">Invalid Scans</p><p className="ad-stat-card-value">{invalidCount} Invalid Attempts</p></div>
            </div>
            <div className="ad-stat-card">
              <div className="ad-stat-card-icon ad-stat-card-icon--logs">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              </div>
              <div><p className="ad-stat-card-label">Scan Logs</p><p className="ad-stat-card-value">Today: {verifiedCount} Valid</p></div>
            </div>
            <div className="ad-stat-card">
              <div className="ad-stat-card-icon ad-stat-card-icon--admins">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>
              </div>
              <div><p className="ad-stat-card-label">Manage Admins</p><p className="ad-stat-card-value">{stats.totalAdmins > 0 ? `${stats.totalAdmins} Admins` : "Loading…"}</p></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;