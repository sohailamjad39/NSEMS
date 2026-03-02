/**
 * Client/src/App.jsx
 *
 * REPLACE your entire existing App.jsx with this file.
 *
 * Changes:
 *  — AuthRoute wraps login: redirects already-logged-in users to their dashboard
 *  — ProtectedRoute wraps every protected page
 *  — All new admin pages added with their routes
 *  — Student change-password wired through ChangePasswordModal
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Route guards
import { ProtectedRoute, AuthRoute } from "./components/ProtectedRoute";

// Public
import Login from "./pages/Login";           // your existing Login page

// Admin pages
import AdminDashboard  from "./pages/AdminDashboard";
import RegisterStudent from "./pages/RegisterStudent";
import AllStudents     from "./pages/AllStudents";
import ScanLogs        from "./pages/ScanLogs";
import ManageAdmins    from "./pages/ManageAdmins";
import AdminSettings   from "./pages/AdminSettings";

// Student page — adjust import path to match yours
import StudentDashboard from "./pages/StudentDashboard"; // your existing student page

const App = () => {
  return (
    <Router>
      <Routes>
        {/* ── Public (redirect if already logged in) ── */}
        <Route
          path="/"
          element={
            <AuthRoute>
              <Login />
            </AuthRoute>
          }
        />

        {/* ── Admin + Scanner routes ── */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute roles={["admin", "scanner"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/register-student"
          element={
            <ProtectedRoute roles={["admin"]}>
              <RegisterStudent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/students"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AllStudents />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scan-logs"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ScanLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/admins"
          element={
            <ProtectedRoute roles={["admin"]}>
              <ManageAdmins />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={["admin", "scanner"]}>
              <AdminSettings />
            </ProtectedRoute>
          }
        />

        {/* ── Student route ── */}
        <Route
          path="/student"
          element={
            <ProtectedRoute roles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── 404 fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;