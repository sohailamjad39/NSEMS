/**
 * Client/src/middleware/authMiddleware.js
 * 
 * Authentication middleware for route protection
 * 
 * CRITICAL FIXES:
 * - Proper token validation
 * - Better error handling
 * - Console logging for debugging
 */

/**
 * Check if user is authenticated and has valid token
 */
export const checkAuth = () => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    console.log('❌ No token found in localStorage');
    return false;
  }

  try {
    // Verify token has not expired
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    console.log('🔐 Token validation:');
    console.log('   Token exists:', !!token);
    console.log('   Token payload:', payload);
    console.log('   Current time:', currentTime);
    console.log('   Token exp:', payload.exp);
    
    if (payload.exp && payload.exp < currentTime) {
      console.log('❌ Token expired - removing from storage');
      localStorage.removeItem('authToken');
      return false;
    }

    console.log('✅ Token is valid');
    return true;
  } catch (error) {
    console.error('❌ Token validation error:', error);
    localStorage.removeItem('authToken');
    return false;
  }
};

/**
 * Check if user has required role
 */
export const checkRole = (allowedRoles) => {
  if (!checkAuth()) {
    console.log('❌ Not authenticated');
    return false;
  }

  const userRole = localStorage.getItem('role') || 
                  (localStorage.getItem('studentId') ? 'student' : null);
  
  console.log('👤 Role check:');
  console.log('   userRole:', userRole);
  console.log('   allowedRoles:', allowedRoles);
  console.log('   hasRole:', allowedRoles.includes(userRole));
  
  return allowedRoles.includes(userRole);
};