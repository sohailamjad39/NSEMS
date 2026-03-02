/**
 * NSEMS/Server/routes/adminRoutes.js
 *
 * BUG FIXED: roleMiddleware must be called as a factory with roles array.
 *
 * Original broken code:
 *   router.get("/", roleMiddleware, authMiddleware, getAllAdmins)
 *
 * Problems:
 *   1. `roleMiddleware` without () just passes the factory function as middleware.
 *      Express calls it with (req, res, next) — it returns an inner function but
 *      never calls it, so next() is never invoked. The route hangs forever.
 *   2. Even if it somehow continued, `roleMiddleware` already calls authMiddleware
 *      internally, so listing authMiddleware separately would run JWT verification
 *      twice (harmless but wasteful).
 *
 * Fix: roleMiddleware(['admin']) — call it with the allowed roles array.
 */

import express from 'express';
import { roleMiddleware } from '../middleware/authMiddleware.js';
import { getAllAdmins, registerAdmin, updateAdmin, deleteAdmin } from '../controllers/adminController.js';

const router = express.Router();

router.get(    '/',         roleMiddleware(['admin']), getAllAdmins);
router.post(   '/register', roleMiddleware(['admin']), registerAdmin);
router.put(    '/:id',      roleMiddleware(['admin']), updateAdmin);
router.delete( '/:id',      roleMiddleware(['admin']), deleteAdmin);

export default router;