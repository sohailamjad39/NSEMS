/**
 * NSEMS/Server/middleware/authMiddleware.js
 *
 * Authentication middleware for protecting routes
 *
 * Features:
 * - JWT token verification
 * - Role-based access control
 * - Protected route enforcement
 * - Handles expired/invalid tokens
 * - Attaches decoded user info to req.user
 *
 * Security Notes:
 * - Tokens are verified using JWT_SECRET
 * - Expired tokens are automatically rejected
 * - Invalid tokens return 401 Unauthorized
 * - Proper error messages don't leak sensitive info
 */

import jwt from "jsonwebtoken";

/**
 * Verify JWT token from request
 *
 * This middleware:
 *   1. Extracts token from Authorization header
 *   2. Verifies token signature and expiration
 *   3. Attaches user information to request object (req.user)
 *   4. Calls next() if valid, otherwise returns 401
 *
 * req.user will contain: { id, role, studentId, name }
 *
 * Usage:
 *   router.get('/protected', authMiddleware, (req, res) => {...})
 */
export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // decoded = { id, role, studentId, name, iat, exp }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      studentId: decoded.studentId,
      name: decoded.name,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired, please log in again",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

/**
 * Role-based access control middleware
 *
 * Usage:
 *   router.get('/admin', roleMiddleware(['admin', 'scanner']), (req, res) => {...})
 *
 * @param {Array<string>} allowedRoles - Allowed roles for this route
 */
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    authMiddleware(req, res, () => {
      try {
        if (!allowedRoles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: "Insufficient permissions",
          });
        }
        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Permission check failed",
        });
      }
    });
  };
};

// Aliases so both import styles work
export const verifyToken = authMiddleware;
export default authMiddleware;