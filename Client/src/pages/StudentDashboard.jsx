/**
 * Client/src/pages/StudentDashboard.jsx
 * 
 * Complete student dashboard with offline-first QR display
 * 
 * Features:
 * - Real-time QR code with countdown timer
 * - Offline-capable QR generation
 * - Professional institutional UI
 * - Auto-logout on authentication failure
 */

// Client/src/pages/StudentDashboard.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudentId, getStudentName, removeToken } from '../services/auth';
import {
  generateQR,
  startQRRefresh,
  stopQRRefresh,
  onQRUpdate,
  getTimeRemaining,
  isQRValid
} from '../services/qrService'; 
import QRCode from 'qrcode';

const QR_SIZE = 280;

const StudentDashboard = () => {
  const [qrData, setQrData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [error, setError] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Initialize student dashboard
  useEffect(() => {
    const initDashboard = async () => {
      const studentId = getStudentId();
      if (!studentId) {
        removeToken();
        navigate('/');
        return;
      }

      // Set student info
      setStudentInfo({
        id: studentId,
        name: getStudentName() || 'Student Name'
      });

      // Initialize QR generation
      try {
        const qr = await generateQR();
        setQrData(qr);
        setTimeRemaining(getTimeRemaining());
        
      } catch (err) {
        console.error('Initial QR generation failed:', err);
        setError(err.message || 'Failed to generate QR code');
      }

      // Start auto-refresh
      startQRRefresh();
    };

    initDashboard();

    return () => {
      stopQRRefresh();
      // Clean up secret key when component unmounts
      // localStorage.removeItem('studentSecretKey');
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
        generateQR().catch(err => {
          console.error('QR regeneration failed:', err);
          setError('Failed to regenerate QR code');
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
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('QR render error:', err);
        setError('Failed to render QR code');
      }
    };

    renderQR();
  }, [qrData]);

  // Handle logout
  const handleLogout = () => {
    removeToken();
    localStorage.removeItem('studentSecretKey');
    navigate('/');
  };

  // Loading state
  if (!studentInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your digital ID...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          {/* <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div> */}
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Digital Student ID</h1>
            <p className="text-sm text-gray-500 mt-1">Secure • Offline-Capable • Dynamic</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ID Card */}
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* University Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">National University of Technology</h2>
              <p className="text-sm opacity-90 mt-1">Digital Identity System</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Student ID</p>
              <p className="text-lg font-bold mt-1">{studentInfo.id}</p>
            </div>
          </div>
        </div>

        {/* Student Info */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-3xl text-gray-400">👤</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{studentInfo.name}</h3>
              <p className="text-sm text-gray-500 mt-1">Software Engineering Department</p>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Scan for Verification</h4>
          </div>

          <div className="relative inline-block mx-auto">
            <canvas
              ref={canvasRef}
              width={QR_SIZE}
              height={QR_SIZE}
              className="border-4 border-white shadow-lg rounded-lg bg-white"
            />
            
            {/* Countdown Badge */}
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border-2 border-white">
              {timeRemaining}s
            </div>

            {/* Validity Indicator */}
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full border border-gray-200">
              <div className={`w-2 h-2 rounded-full ${timeRemaining > 5 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span className="text-xs font-medium text-gray-700">
                {timeRemaining > 5 ? 'Valid' : 'Expiring Soon'}
              </span>
            </div>
          </div>

          {/* Security Info */}
          <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-emerald-800 font-medium">Security Notice</p>
                <p className="text-xs text-emerald-700 mt-1">
                  This QR code refreshes every 60 seconds. Screenshots are invalid after expiration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto mt-6 text-center text-xs text-gray-400">
        <p>© 2026 National University of Technology. All rights reserved.</p>
      </div>
    </div>
  );
};

export default StudentDashboard;