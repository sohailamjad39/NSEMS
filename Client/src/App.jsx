/**
 * Client/src/App.jsx
 *
 * Main application component with routing and authentication
 *
 * CRITICAL FIXES:
 * - React Router v7 requires different syntax
 * - Fixed authentication redirect logic
 * - Added proper route protection
 * - Added console logging for debugging
 */

import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import RegisterStudent from "./pages/RegisterStudent";
import "./App.css";

// Debug component to see route changes
const RouteDebugger = () => {
  const location = useLocation();

  useEffect(() => {
    console.log("📍 Route changed:", location.pathname);
    console.log("   Search:", location.search);
    console.log("   State:", location.state);
  }, [location]);

  return null;
};

// Root redirect logic
const RootRedirect = () => {
  const token = localStorage.getItem("authToken");
  const role =
    localStorage.getItem("role") ||
    (localStorage.getItem("studentId") ? "student" : null);

  console.log("🔄 Root redirect check:");
  console.log("   Token exists:", !!token);
  console.log("   Role detected:", role);

  if (token) {
    if (role === "student") {
      console.log("   ➡️  Redirecting to /student-id");
      return <Navigate to="/student-id" replace />;
    } else if (role === "admin" || role === "scanner") {
      console.log("   ➡️  Redirecting to /admin-dashboard");
      return <Navigate to="/admin-dashboard" replace />;
    }
  }

  console.log("   ➡️  Redirecting to /login");
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <RouteDebugger />
      <Routes>
        {/* Root route - redirect based on auth state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Student Dashboard - Protected */}
        <Route
          path="/student-id"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard - Protected */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin", "scanner"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/register-student"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <RegisterStudent />
            </ProtectedRoute>
          }
        />

        {/* Catch-all - Redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
