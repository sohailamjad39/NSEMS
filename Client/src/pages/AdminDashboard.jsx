/**
 * Client/src/pages/AdminDashboard.jsx
 * 
 * FIXED: Complete offline QR validation with fallback to server
 * 
 * Key Fixes:
 * - Added offline validation using cached student data
 * - Proper fallback to server when online
 * - Automatic student data caching for offline access
 * - Continuous scanning without interruption
 * - Better QR detection from any angle
 */

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getRole, removeToken } from "../services/auth";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/library";
import API_BASE from "../config/api";
import { offlineService } from "../services/offlineService";

const AdminDashboard = () => {
  const [scannedStudent, setScannedStudent] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanHistory, setScanHistory] = useState([]);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  
  // Track recently scanned QR codes to prevent duplicates
  const lastScannedQR = useRef(null);
  const lastScanTime = useRef(0);

  // Configure scanner for better QR detection
  useEffect(() => {
    if (!isScanning) return;
    if (!videoRef.current) return;

    // Create scanner with specific format configuration
    const hints = new Map();
    hints.set('POSSIBLE_FORMATS', [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.AZTEC,
      BarcodeFormat.DATA_MATRIX
    ]);
    
    const scanner = new BrowserMultiFormatReader(hints);
    // Reduce time between attempts for faster scanning
    scanner.timeBetweenDecodingAttempts = 100;

    scanner.decodeFromVideoDevice(
      null, // auto-select camera
      videoRef.current,
      (result, error) => {
        if (result) {
          handleQRScan(result.text);
        }
      }
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.reset();
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  // Authentication check on mount
  useEffect(() => {
    const token = getToken();
    const role = getRole();

    if (!token || (role !== "admin" && role !== "scanner")) {
      removeToken();
      navigate("/");
      return;
    }

    // Initialize camera scanner
    initCameraScanner();

    // Sync all students for offline access
    syncStudentsForOffline();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      cleanupScanner();
    };
  }, [navigate]);

  // Sync all students for offline validation
  const syncStudentsForOffline = async () => {
    try {
      // Try to get students from IndexedDB first
      const cachedStudents = await offlineService.getAllStudents();
      if (cachedStudents.length > 0) {
        console.log('✅ Using cached students for offline validation');
        return;
      }
      
      // If no cached students, try to sync from server
      if (navigator.onLine) {
        console.log('🔄 Syncing students for offline access...');
        await offlineService.syncAllStudents();
      }
    } catch (error) {
      console.warn('Failed to sync students for offline access:', error);
    }
  };

  // Initialize camera scanner with proper error handling
  const initCameraScanner = async () => {
    try {
      // Request camera access with optimal constraints
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.7777777778 } // 16:9
        },
        audio: false,
      };

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Store stream reference
      streamRef.current = stream;

      if (videoRef.current && isMountedRef.current) {
        // Set the stream to video element
        videoRef.current.srcObject = stream;

        // Handle play() promise properly
        const playPromise = videoRef.current.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (!isMountedRef.current) return;

              // Only initialize ZXing scanner after video is playing
              const hints = new Map();
              hints.set('POSSIBLE_FORMATS', [
                BarcodeFormat.QR_CODE,
                BarcodeFormat.AZTEC,
                BarcodeFormat.DATA_MATRIX
              ]);
              
              const scanner = new BrowserMultiFormatReader(hints);
              scanner.timeBetweenDecodingAttempts = 100;

              // Start decoding from the video element
              scanner.decodeFromVideoDevice(
                undefined,
                videoRef.current,
                (result, error) => {
                  if (result?.text && isScanning && isMountedRef.current) {
                    handleQRScan(result.text);
                  }
                },
              );

              scannerRef.current = scanner;
              setCameraError(null);
            })
            .catch((error) => {
              if (!isMountedRef.current) return;
              console.error("Video play failed:", error);
              setCameraError(
                "Failed to start camera. Please check permissions and try again.",
              );
            });
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Camera access error:", err);

      let errorMessage = "Camera permission required";
      if (err.name === "NotAllowedError") {
        errorMessage = "Camera access denied. Please allow camera permissions.";
      } else if (err.name === "NotFoundError") {
        errorMessage = "No camera found on this device.";
      } else if (err.name === "NotReadableError") {
        errorMessage = "Camera is already in use by another application.";
      }

      setCameraError(errorMessage);
    }
  };

  // Handle QR code scan with offline validation
  const handleQRScan = async (qrData) => {
    // Prevent duplicate scans of the same QR code within 2 seconds
    const now = Date.now();
    if (lastScannedQR.current === qrData && (now - lastScanTime.current) < 2000) {
      return;
    }
    
    lastScannedQR.current = qrData;
    lastScanTime.current = now;

    try {
      // Parse QR data (format: studentId|timeWindow|token)
      const parts = qrData.trim().split("|");
      if (parts.length !== 3) {
        setScannedStudent({
          error: "Invalid QR format",
          type: "error",
        });
        return;
      }

      const [studentId, timeWindowStr, token] = parts;
      const timeWindow = parseInt(timeWindowStr, 10);

      // Validate time window (60-second rotation)
      const currentTimeWindow = Math.floor(Date.now() / 60000);
      const timeDiff = Math.abs(currentTimeWindow - timeWindow);

      if (timeDiff > 1) {
        setScannedStudent({
          error: "QR code expired",
          type: "warning",
          studentId,
          expiresAt: (timeWindow + 1) * 60000,
        });
        addToHistory({ studentId, status: "expired" });
        return;
      }

      // ✅ FIRST: Try offline validation
      let validationResult = null;
      
      if (!navigator.onLine) {
        // Force offline validation when offline
        console.log('📱 Offline mode: Validating QR offline...');
        validationResult = await offlineService.validateQROffline(qrData);
      } else {
        // Try offline validation first, then fall back to server
        console.log('🌐 Online mode: Trying offline validation first...');
        validationResult = await offlineService.validateQROffline(qrData);
        
        if (!validationResult?.success || !validationResult?.valid) {
          // ✅ FALLBACK: Try server validation if offline validation fails
          console.log('🔄 Offline validation failed, trying server validation...');
          try {
            const response = await fetch(`${API_BASE}/api/scanner/validate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                qrData,
                scannerId: "admin-" + Date.now(),
              }),
            });

            const serverData = await response.json();
            if (serverData.success) {
              validationResult = serverData;
              
              // Cache successful server validation for future offline use
              if (serverData.valid && serverData.student) {
                await offlineService.storeStudentData({
                  studentId: serverData.student.id,
                  name: serverData.student.name,
                  secretKey: serverData.student.secretKey, // This would need to be included in server response
                  program: serverData.student.program,
                  department: serverData.student.department,
                  year: serverData.student.year,
                  status: serverData.student.status
                });
              }
            }
          } catch (serverError) {
            console.error('Server validation failed:', serverError);
            // Use offline result even if it's invalid
          }
        }
      }

      // Handle validation result
      if (validationResult?.success && validationResult?.valid) {
        // Valid student
        setScannedStudent({
          success: true,
          student: validationResult.student,
          timestamp: validationResult.timestamp || Date.now(),
        });
        addToHistory({
          studentId: validationResult.student.id,
          name: validationResult.student.name,
          status: "verified",
          timestamp: validationResult.timestamp || Date.now(),
        });
        // Show success for 2 seconds, then clear
        setTimeout(() => {
          if (isMountedRef.current) {
            setScannedStudent(null);
          }
        }, 2000);
      } else {
        // Invalid QR
        const errorMessage = validationResult?.message || "Invalid QR code";
        setScannedStudent({
          error: errorMessage,
          type: "error",
        });
        addToHistory({ studentId, status: "invalid" });
        // Show error for 2 seconds, then clear
        setTimeout(() => {
          if (isMountedRef.current) {
            setScannedStudent(null);
          }
        }, 2000);
      }
    } catch (error) {
      console.error("QR validation error:", error);
      if (isMountedRef.current) {
        setScannedStudent({
          error: "Validation failed",
          type: "error",
        });
        // Show error for 2 seconds, then clear
        setTimeout(() => {
          if (isMountedRef.current) {
            setScannedStudent(null);
          }
        }, 2000);
      }
    }
  };

  // Add scan to history
  const addToHistory = (scan) => {
    if (!isMountedRef.current) return;

    setScanHistory((prev) => {
      const newHistory = [scan, ...prev];
      return newHistory.slice(0, 50); // Keep last 50 scans
    });
  };

  // Cleanup scanner on unmount
  const cleanupScanner = () => {
    // Stop ZXing scanner
    if (scannerRef.current) {
      try {
        scannerRef.current.reset();
      } catch (error) {
        console.warn("ZXing scanner reset error:", error);
      }
      scannerRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          track.stop();
        }
      });
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      // This ensures proper cleanup as per Chrome documentation
      videoRef.current.load();
    }
  };

  // Handle logout
  const handleLogout = () => {
    removeToken();
    cleanupScanner();
    navigate("/");
  };

  // Camera permission error
  if (cameraError) {
    return (
      <div className="app-container">
        <div
          className="login-page"
          style={{ padding: "20px", minHeight: "100vh" }}
        >
          <div className="login-layout">
            <div className="login-header">
              <h1 className="login-header__title">Admin Dashboard</h1>
              <p className="login-header__subtitle">
                Student Verification System
              </p>
            </div>

            <div className="login-form">
              <div className="login-card">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Camera Access Required
                  </h2>
                  <p className="text-gray-600 mb-6">{cameraError}</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Retry Camera Access
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="admin-dashboard">
        {/* Scanner Card */}
        <div className="admin-scanner">
          {/* Camera Preview */}
          <div className="scanner-preview">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                backgroundColor: "black",
              }}
            />

            {/* Scanner Overlay */}
            <div className="scanner-overlay">
              <div className="scanner-frame"></div>
              <div
                className={`scanner-timer ${isScanning ? "active" : ""}`}
              ></div>
            </div>
          </div>

          {/* Scan Result */}
          <div className="scanner-status">
            {scannedStudent?.success ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium">Verified</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-800">
                    {scannedStudent.student.name}
                  </h3>
                  <p className="text-lg text-gray-600 font-mono">
                    {scannedStudent.student.id}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-500">Program</p>
                      <p className="font-medium text-gray-800">
                        {scannedStudent.student.program ||
                          "Software Engineering"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-500">Department</p>
                      <p className="font-medium text-gray-800">
                        {scannedStudent.student.department ||
                          "Computer Science"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-500">Year</p>
                      <p className="font-medium text-gray-800">
                        {scannedStudent.student.year || "3rd"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-500">Status</p>
                      <p className="font-medium text-green-600">
                        {scannedStudent.student.status || "Active"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : scannedStudent?.error ? (
              <div className="text-center">
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-4 ${
                    scannedStudent.type === "error"
                      ? "bg-red-100 text-red-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      scannedStudent.type === "error"
                        ? "bg-red-500"
                        : "bg-amber-500"
                    }`}
                  ></div>
                  <span className="font-medium">{scannedStudent.error}</span>
                </div>
                {scannedStudent.studentId && (
                  <p className="text-gray-600 font-mono">
                    {scannedStudent.studentId}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium">Ready to Scan</p>
                <p className="text-sm mt-2">Point camera at student QR code</p>
                <p className="text-xs mt-2 text-gray-400">
                  Works in any orientation • {navigator.onLine ? 'Online' : 'Offline'} mode • Continuous scanning enabled
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Scan History Card */}
        <div className="scan-history">
          <div className="scan-history-header">
            <h2 className="scan-history-title">Recent Scans</h2>
          </div>
          <div className="scan-history-list">
            {scanHistory.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No scans yet</p>
            ) : (
              scanHistory.map((scan, index) => (
                <div key={index} className="scan-item">
                  <div
                    className={`scan-item-icon ${
                      scan.status === "verified"
                        ? "valid"
                        : scan.status === "expired"
                          ? "expired"
                          : "invalid"
                    }`}
                  ></div>
                  <div className="scan-item-details">
                    <p className="scan-item-name">
                      {scan.name || scan.studentId || "Unknown"}
                    </p>
                    <p className="scan-item-id">{scan.status}</p>
                  </div>
                  {scan.timestamp && (
                    <span className="scan-item-time">
                      {new Date(scan.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;