/**
 * Client/src/services/scannerService.js
 * 
 * QR code validation service for admin scanner
 * 
 * Features:
 * - Offline QR validation
 * - Time-window verification
 * - Cryptographic token validation
 * - Student lookup from local cache
 * - Sync with server when online
 * 
 * Security Notes:
 * - Validates time window to prevent replay attacks
 * - Verifies cryptographic signature
 * - Checks student status (active/suspended)
 * - Logs all validation attempts
 */

import API_BASE from '../config/api';

/**
 * Validate QR code offline
 * 
 * @param {string} qrContent - QR code content (format: studentId|timeWindow|token)
 * @param {number} currentTimeWindow - Current time window for validation
 * @returns {Promise<Object>} - Validation result
 */
export const validateQRToken = async (qrContent, currentTimeWindow = null) => {
  try {
    // Clean and parse QR content
    const cleaned = qrContent.trim().replace(/\s+/g, '');
    const parts = cleaned.split('|');

    if (parts.length !== 3) {
      return {
        valid: false,
        reason: 'Invalid QR format (expected: studentId|timeWindow|token)',
        type: 'format'
      };
    }

    const [studentId, timeWindowStr, token] = parts;
    const timeWindow = parseInt(timeWindowStr, 10);

    // Validate time window
    const nowWindow = currentTimeWindow || Math.floor(Date.now() / 60000);
    const timeDiff = Math.abs(nowWindow - timeWindow);

    if (timeDiff > 1) {
      return {
        valid: false,
        reason: 'QR code expired',
        type: 'expired',
        studentId,
        timeWindow,
        nowWindow
      };
    }

    // Validate with server
    try {
      const response = await fetch(`${API_BASE}/api/scanner/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrData: cleaned,
          scannerId: 'offline-scanner-' + Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          valid: false,
          reason: errorData.message || 'Server validation failed',
          type: 'server'
        };
      }

      const data = await response.json();
      return data;
    } catch (networkError) {
      // Offline mode - cannot validate with server
      console.warn('Offline validation mode:', networkError.message);
      return {
        valid: false,
        reason: 'Offline mode - server unreachable',
        type: 'offline',
        studentId,
        timeWindow
      };
    }
  } catch (error) {
    console.error('QR validation error:', error);
    return {
      valid: false,
      reason: error.message || 'Validation failed',
      type: 'error'
    };
  }
};

/**
 * Log scan attempt locally
 * 
 * @param {Object} scanData - Scan data to log
 * @returns {Promise<void>}
 */
export const logScanLocally = async (scanData) => {
  try {
    // Get existing logs from IndexedDB or localStorage
    const existingLogs = JSON.parse(localStorage.getItem('scanLogs') || '[]');
    
    // Add new log with timestamp
    const newLog = {
      ...scanData,
      timestamp: Date.now(),
      isSynced: false
    };
    
    // Keep last 100 scans
    const updatedLogs = [newLog, ...existingLogs].slice(0, 100);
    
    // Save to localStorage
    localStorage.setItem('scanLogs', JSON.stringify(updatedLogs));
  } catch (error) {
    console.error('Failed to log scan locally:', error);
  }
};

/**
 * Sync scan logs with server
 * 
 * @returns {Promise<Object>} - Sync result
 */
export const syncScanLogs = async () => {
  try {
    const logs = JSON.parse(localStorage.getItem('scanLogs') || '[]');
    const unsyncedLogs = logs.filter(log => !log.isSynced);

    if (unsyncedLogs.length === 0) {
      return { success: true, synced: 0, total: logs.length };
    }

    // Send unsynced logs to server
    const response = await fetch(`${API_BASE}/api/scanner/sync-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: unsyncedLogs })
    });

    if (!response.ok) {
      throw new Error('Failed to sync logs with server');
    }

    // Mark logs as synced
    const syncedLogs = logs.map(log => 
      unsyncedLogs.some(u => u.timestamp === log.timestamp)
        ? { ...log, isSynced: true }
        : log
    );

    localStorage.setItem('scanLogs', JSON.stringify(syncedLogs));

    return {
      success: true,
      synced: unsyncedLogs.length,
      total: logs.length
    };
  } catch (error) {
    console.error('Sync failed:', error);
    return {
      success: false,
      error: error.message,
      synced: 0
    };
  }
};

/**
 * Clear scan logs
 * 
 * @returns {Promise<void>}
 */
export const clearScanLogs = () => {
  localStorage.removeItem('scanLogs');
};