// Client/src/services/auth.js
import { offlineService } from './offlineService';

export const getToken = () => localStorage.getItem('authToken');
export const setToken = (token) => localStorage.setItem('authToken', token);

export const removeToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
  localStorage.removeItem('role');
  localStorage.removeItem('adminName');
  localStorage.removeItem('studentSecretKey');
};

export const getStudentId = () => localStorage.getItem('studentId');
export const getStudentName = () => localStorage.getItem('studentName');

export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  } catch {
    return false;
  }
};

export const getRole = () => {
  const storedRole = localStorage.getItem('role');
  if (storedRole) return storedRole;
  
  const token = getToken();
  if (!token) return null;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
};

/**
 * Enhanced login function with automatic caching
 */
export const login = async (identifier, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || 'Invalid credentials');
  }

  const data = await response.json();

  // Store token and user info immediately
  setToken(data.token);
  
  if (data.role === 'student') {
    localStorage.setItem('studentId', data.studentId);
    localStorage.setItem('studentName', data.name);
    localStorage.setItem('role', 'student');
    
    if (data.secretKey) {
      localStorage.setItem('studentSecretKey', data.secretKey);
    }
  } else if (data.role === 'admin' || data.role === 'scanner') {
    localStorage.setItem('role', data.role);
    localStorage.setItem('adminName', data.name);
  }

  await offlineService.storeLoginData(data);
  
  if (data.role === 'admin' || data.role === 'scanner') {
    await offlineService.storeAdminData(data);
  }

  return { 
    role: data.role, 
    token: data.token,
    studentId: data.studentId,
    name: data.name
  };
};

/**
 * Cache login data immediately after successful login
 */
const cacheLoginData = async (loginData) => {
  try {
    // Store in IndexedDB for offline access
    await offlineService.storeLoginData(loginData);
    
    // If student, also store student data
    if (loginData.role === 'student') {
      await offlineService.storeStudentData({
        studentId: loginData.studentId,
        name: loginData.name,
        secretKey: loginData.secretKey,
        program: 'Software Engineering',
        department: 'Computer Science',
        year: 3,
        status: 'active'
      });
    }
    
    // ✅ Force cache the current page for offline access
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Cache the current page
        const url = window.location.href;
        registration.active.postMessage({
          action: 'CACHE_PAGE',
          url: url
        });
        
        // Cache critical assets
        registration.active.postMessage({
          action: 'CACHE_ASSETS',
          assets: [
            '/index.html',
            '/src/App.css',
            '/src/main.jsx',
            '/src/App.jsx'
          ]
        });
      });
    }
    
    console.log('✅ Login data cached successfully');
  } catch (error) {
    console.error('Failed to cache login ', error);
  }
};