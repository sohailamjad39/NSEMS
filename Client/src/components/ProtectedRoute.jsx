/**
 * Client/src/components/ProtectedRoute.jsx
 *
 * ProtectedRoute  — only allows logged-in users (optionally by role)
 * AuthRoute       — redirects already-logged-in users away from /login etc.
 *
 * Usage in App.jsx:
 *   <Route path="/" element={<AuthRoute><LoginPage /></AuthRoute>} />
 *   <Route path="/admin-dashboard" element={<ProtectedRoute roles={["admin","scanner"]}><AdminDashboard /></ProtectedRoute>} />
 *   <Route path="/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { getToken, getRole } from "../services/auth";

/**
 * Blocks unauthenticated (or wrong-role) users.
 * @param {string[]} [roles]  If provided, user's role must be in this list.
 * @param {string}   [redirectTo="/"] Where to redirect on auth failure.
 */
export const ProtectedRoute = ({ children, roles, redirectTo = "/" }) => {
  const token = getToken();
  const role  = getRole();

  if (!token)                          return <Navigate to={redirectTo} replace />;
  if (roles && !roles.includes(role))  return <Navigate to={redirectTo} replace />;

  return children;
};

/**
 * For public-only pages (login, register).
 * Redirects already-authenticated users to their dashboard.
 */
export const AuthRoute = ({ children }) => {
  const token = getToken();
  const role  = getRole();

  if (!token) return children;

  // Already logged in → redirect to relevant dashboard
  if (role === "admin" || role === "scanner") return <Navigate to="/admin-dashboard" replace />;
  if (role === "student")                     return <Navigate to="/student"         replace />;
  return children;
};