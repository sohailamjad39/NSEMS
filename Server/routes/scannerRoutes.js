/**
 * NSEMS/Server/routes/scannerRoutes.js
 * 
 * Scanner routes for QR code validation and scan logging
 * 
 * Features:
 * - QR validation endpoint
 * - Scan log management
 * - Offline-first sync support
 * 
 * Security Notes:
 * - Time-window validation prevents replay attacks
 * - Scan logs are stored for audit purposes
 * - Proper rate limiting should be added in production
 */

import express from 'express';
import { validateQR } from '../controllers/scannerController.js';

const router = express.Router();

/**
 * POST /api/scanner/validate
 * 
 * Validate QR code scanned by admin/scanner
 * 
 * Request Body:
 *   - qrData: QR code content (format: "studentId|timeWindow|token")
 *   - scannerId: ID of the scanner/admin performing validation
 * 
 * Response:
 *   - success: boolean
 *   - valid: boolean (true if QR is valid)
 *   - student: Student information (if valid)
 *   - message: Validation message
 *   - timestamp: Validation timestamp
 * 
 * Validation Flow:
 *   1. Parse QR data
 *   2. Validate time window (60-second rotation)
 *   3. Verify cryptographic token
 *   4. Retrieve student information
 *   5. Log scan attempt
 *   6. Return validation result
 */
router.post('/validate', validateQR);

export default router;