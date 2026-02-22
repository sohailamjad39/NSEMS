/**
 * NSEMS/Server/middleware/errorHandler.js
 * 
 * Centralized error handling middleware
 * 
 * Features:
 * - Consistent error responses
 * - Proper HTTP status codes
 * - Error logging
 * - Production-safe error messages
 * 
 * Security Notes:
 * - Stack traces are hidden in production
 * - Errors are logged for debugging
 * - Client receives generic error messages in production
 */

/**
 * Error handler middleware
 * 
 * This middleware:
 *   1. Logs errors to console
 *   2. Provides detailed errors in development
 *   3. Provides generic errors in production
 *   4. Ensures consistent error response format
 * 
 * Usage:
 *   Place this middleware LAST in the middleware chain
 *   app.use(errorHandler);
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function (not used)
 */
export const errorHandler = (err, req, res, next) => {
  // Log error details (for debugging)
  console.error('=== ERROR ===');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('=============');

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Determine error message
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
};

/**
 * Not found handler middleware
 * 
 * This middleware:
 *   1. Catches all unmatched routes
 *   2. Returns 404 Not Found
 *   3. Provides helpful error message
 * 
 * Usage:
 *   Place this middleware BEFORE errorHandler
 *   app.use(notFoundHandler);
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};