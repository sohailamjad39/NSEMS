/**
 * NSEMS/Server/middleware/authMiddleware.js
 * 
 * Authentication middleware for protecting routes
 * 
 * Features:
 * - JWT token verification
 * - Role-based access control
 * - Protected route enforcement
 * 
 * Security Notes:
 * - Tokens are verified using JWT_SECRET
 * - Expired tokens are automatically rejected
 * - Invalid tokens return 401 Unauthorized
 * - Proper error messages don't leak sensitive information
 */

import jwt from 'jsonwebtoken';

/**
 * Verify JWT token from request
 * 
 * This middleware:
 *   1. Extracts token from Authorization header
 *   2. Verifies token signature and expiration
 *   3. Attaches user information to request object
 *   4. Continues to next middleware if valid
 * 
 * Usage:
 *   router.get('/protected', authMiddleware, (req, res) => {...})
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user information to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      studentId: decoded.studentId,
      name: decoded.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Role-based access control middleware
 * 
 * This middleware:
 *   1. Verifies user is authenticated (calls authMiddleware)
 *   2. Checks if user has required role(s)
 *   3. Allows access if role matches
 *   4. Rejects with 403 Forbidden if role doesn't match
 * 
 * Usage:
 *   router.get('/admin', roleMiddleware(['admin', 'scanner']), (req, res) => {...})
 * 
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} - Middleware function
 */
export const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    // First verify authentication
    authMiddleware(req, res, async () => {
      try {
        // Check if user role is allowed
        if (!allowedRoles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: 'Permission check failed'
        });
      }
    });
  };
};