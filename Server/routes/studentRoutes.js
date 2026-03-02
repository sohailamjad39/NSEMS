/**
 * NSEMS/Server/routes/studentRoutes.js
 *
 * Route order is correct — /all-details, /sync-all, /stats are all registered
 * BEFORE /:studentId, so Express never mistakes them for a studentId param.
 * No changes needed here; included for completeness.
 */

import express from 'express';
import {
  registerStudent,
  getAllStudents,
  syncAllStudents,
  getStudentStats,
  getAllStudentsDetails,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';
import { roleMiddleware, authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Fixed routes BEFORE the /:studentId wildcard — order is correct, no change needed
router.post('/register',     roleMiddleware(['admin']), registerStudent);
router.get('/',              roleMiddleware(['admin']), getAllStudents);
router.get('/sync-all',      authMiddleware,            syncAllStudents);
router.get('/stats',         authMiddleware,            getStudentStats);
router.get('/all-details',   authMiddleware,            getAllStudentsDetails);

// Wildcard param routes LAST
router.put('/:studentId',    authMiddleware,            updateStudent);
router.delete('/:studentId', authMiddleware,            deleteStudent);

export default router;