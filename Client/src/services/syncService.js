/**
 * Client/src/services/syncService.js
 * 
 * Offline sync service for scan logs and data synchronization
 * 
 * Features:
 * - Background sync when online
 * - Conflict resolution
 * - Queue management
 * - Network status detection
 */

import API_BASE from '../config/api';

// Sync queue for offline operations
let syncQueue = [];
let isSyncing = false;

// Initialize sync queue from localStorage
const initSyncQueue = () => {
  try {
    const savedQueue = localStorage.getItem('syncQueue');
    if (savedQueue) {
      syncQueue = JSON.parse(savedQueue);
    }
  } catch (error) {
    console.warn('Failed to load sync queue:', error);
    syncQueue = [];
  }
};

// Save sync queue to localStorage
const saveSyncQueue = () => {
  try {
    localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
  } catch (error) {
    console.warn('Failed to save sync queue:', error);
  }
};

// Add item to sync queue
export const addToSyncQueue = (operation) => {
  syncQueue.push({
    ...operation,
    timestamp: Date.now(),
    attempts: 0
  });
  saveSyncQueue();
  triggerSync();
};

// Trigger background sync
const triggerSync = async () => {
  if (isSyncing || syncQueue.length === 0) return;
  
  isSyncing = true;
  
  try {
    // Check if online
    if (!navigator.onLine) {
      isSyncing = false;
      return;
    }

    const failedOperations = [];
    
    for (const operation of syncQueue) {
      try {
        const response = await fetch(`${API_BASE}${operation.endpoint}`, {
          method: operation.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(operation.data)
        });

        if (!response.ok) {
          operation.attempts++;
          if (operation.attempts < 3) {
            failedOperations.push(operation);
          }
        }
        // If successful, don't add back to queue
      } catch (error) {
        operation.attempts++;
        if (operation.attempts < 3) {
          failedOperations.push(operation);
        }
      }
    }

    syncQueue = failedOperations;
    saveSyncQueue();
  } finally {
    isSyncing = false;
    
    // Continue syncing if there are more items
    if (syncQueue.length > 0) {
      setTimeout(triggerSync, 5000); // Retry after 5 seconds
    }
  }
};

// Listen for online/offline events
window.addEventListener('online', triggerSync);
window.addEventListener('offline', () => {
  console.log('Offline mode activated');
});

// Initialize on app startup
initSyncQueue();

// Export sync functions
export const getSyncQueueLength = () => syncQueue.length;
export const clearSyncQueue = () => {
  syncQueue = [];
  saveSyncQueue();
};