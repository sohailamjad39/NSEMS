// Server/routes/scannerRoutes.js
import express from 'express';
import { validateQR, getScanLogs, syncLogs } from '../controllers/scannerController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/scanner/validate  — validate a QR code (no auth needed so scanner device can call it)
router.post('/validate', validateQR);

// GET /api/scanner/logs  — get scan logs (admin/scanner only)
router.get('/logs', authMiddleware, getScanLogs);

// POST /api/scanner/sync-logs  — sync offline logs to DB
router.post('/sync-logs', syncLogs);

export default router;