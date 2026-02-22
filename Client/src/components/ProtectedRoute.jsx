/**
 * Client/src/components/ProtectedRoute.jsx
 * 
 * Protected route component for React Router
 * 
 * CRITICAL FIXES:
 * - Proper authentication checking
 * - Better error handling
 * - Console logging for debugging
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { checkAuth, checkRole } from '../middleware/authMiddleware';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const isAuth = checkAuth();
  const userRole = localStorage.getItem('role') || 
                  (localStorage.getItem('studentId') ? 'student' : null);

  console.log('🔒 ProtectedRoute check:');
  console.log('   isAuthenticated:', isAuth);
  console.log('   userRole:', userRole);
  console.log('   allowedRoles:', allowedRoles);
  console.log('   hasRequiredRole:', allowedRoles.includes(userRole));

  // If not authenticated, redirect to login
  if (!isAuth) {
    console.log('   ❌ Not authenticated - redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // If roles are specified, check if user has allowed role
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    console.log('   ❌ Role mismatch - redirecting to appropriate dashboard');
    // Redirect to user's default page based on their role
    if (userRole === 'student') {
      return <Navigate to="/student-id" replace />;
    } else if (userRole === 'admin' || userRole === 'scanner') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  console.log('   ✅ Access granted - rendering children');
  return children;
};

export default ProtectedRoute;