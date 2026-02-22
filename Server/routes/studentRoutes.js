// Server/routes/studentRoutes.js
import express from 'express';
import { registerStudent, getAllStudents, syncAllStudents } from '../controllers/studentController.js';
import { roleMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', roleMiddleware(['admin']), registerStudent);
router.get('/', roleMiddleware(['admin']), getAllStudents);
router.get('/sync-all', roleMiddleware(['admin']), syncAllStudents);

export default router;