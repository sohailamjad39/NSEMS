/**
 * NSEMS/Server/routes/authRoutes.js
 * 
 * Authentication routes for the digital student ID system
 * 
 * Features:
 * - Login endpoint for both students and admins
 * - Proper route organization
 * - Middleware integration ready
 * 
 * Security Notes:
 * - All routes use proper validation
 * - Error handling is consistent
 * - No sensitive data exposed in routes
 */

import express from 'express';
import { login, changePassword } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * 
 * Student/Admin login endpoint
 * 
 * Request Body:
 *   - identifier: Student ID (e.g., "NSE-202601") OR Admin email/phone
 *   - password: User password
 * 
 * Response:
 *   - success: boolean
 *   - role: 'student' | 'admin' | 'scanner'
 *   - token: JWT token
 *   - studentId: Student ID (for students only)
 *   - name: User name
 * 
 * Authentication Flow:
 *   1. Client sends identifier and password
 *   2. Server determines user type (student vs admin)
 *   3. Validates credentials
 *   4. Generates JWT with role information
 *   5. Returns token and user details
 */
router.post('/login', login);
router.post("/change-password", authMiddleware, changePassword);

export default router;