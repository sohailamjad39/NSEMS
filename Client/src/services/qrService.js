// Client/src/services/qrService.js
import { getStudentId, getToken } from './auth';
import { offlineService } from './offlineService';

const QR_ROTATION_MS = 60000;
let currentQR = null;
let refreshTimer = null;
const listeners = [];

/**
 * Get secret key with offline support
 */
const getSecretKey = async () => {
  // Try localStorage first
  const storedKey = localStorage.getItem('studentSecretKey');
  if (storedKey && storedKey !== 'null' && storedKey !== 'undefined') {
    return storedKey;
  }
  
  // Try JWT token
  const token = getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.secretKey && payload.secretKey !== 'null' && payload.secretKey !== 'undefined') {
        localStorage.setItem('studentSecretKey', payload.secretKey);
        return payload.secretKey;
      }
    } catch (error) {
      console.warn('Failed to extract secret key from token:', error);
    }
  }
  
  // Try IndexedDB (offline support)
  const loginData = await offlineService.getLoginData();
  if (loginData && loginData.secretKey) {
    localStorage.setItem('studentSecretKey', loginData.secretKey);
    return loginData.secretKey;
  }
  
  return null;
};

/**
 * Generate cryptographically secure QR token
 */
const generateSecureToken = async (studentId, timeWindow, secretKey) => {
  if (!secretKey) {
    throw new Error('Secret key not available. Please contact administrator.');
  }

  return await offlineService.generateSecureToken(studentId, timeWindow, secretKey);
};

/**
 * Generate new QR code
 */
export const generateQR = async () => {
  const studentId = getStudentId();
  if (!studentId) {
    throw new Error('Authentication required. Please login again.');
  }

  try {
    const timeWindow = Math.floor(Date.now() / QR_ROTATION_MS);
    const secretKey = await getSecretKey();
    
    if (!secretKey) {
      throw new Error('Secret key not available. Please re-login.');
    }

    const qrToken = await generateSecureToken(studentId, timeWindow, secretKey);

    currentQR = {
      success: true,
      studentId,
      timeWindow,
      token: `${studentId}|${timeWindow}|${qrToken}`,
      expiresAt: (timeWindow + 1) * QR_ROTATION_MS,
      timestamp: Date.now()
    };

    notifyListeners();
    return currentQR;
  } catch (error) {
    console.error('QR generation error:', error);
    throw error;
  }
};

// Rest of the functions remain the same...
const notifyListeners = () => {
  listeners.forEach(callback => {
    if (typeof callback === 'function') {
      callback(currentQR);
    }
  });
};

export const getCurrentQR = () => currentQR;
export const isQRValid = () => {
  if (!currentQR) return false;
  return Date.now() < currentQR.expiresAt;
};
export const getTimeRemaining = () => {
  if (!currentQR) return 0;
  return Math.max(0, Math.floor((currentQR.expiresAt - Date.now()) / 1000));
};

export const startQRRefresh = () => {
  stopQRRefresh();
  const scheduleNextRefresh = async () => {
    try {
      await generateQR();
      const now = Date.now();
      const msToNextWindow = QR_ROTATION_MS - (now % QR_ROTATION_MS);
      refreshTimer = setTimeout(scheduleNextRefresh, msToNextWindow);
    } catch (error) {
      console.error('QR refresh error:', error);
      refreshTimer = setTimeout(scheduleNextRefresh, 5000);
    }
  };
  scheduleNextRefresh();
};

export const stopQRRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

export const onQRUpdate = (callback) => {
  if (typeof callback !== 'function') {
    console.warn('onQRUpdate: callback must be a function');
    return () => {};
  }
  listeners.push(callback);
  if (currentQR) {
    callback(currentQR);
  }
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

export const cleanupQRService = () => {
  stopQRRefresh();
  listeners.length = 0;
  currentQR = null;
  localStorage.removeItem('studentSecretKey');
};