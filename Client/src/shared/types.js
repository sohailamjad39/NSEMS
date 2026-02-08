/**
 * Client/src/shared/types.js
 * 
 * 2026 type definitions (critical for login system)
 * 
 * This file was missing in previous implementation — now fully fixed.
 */
/**
 * Role enumeration for RBAC
 * 
 * Student: Digital ID card holder
 * Admin: Full system administrator
 * Scanner: QR code verification specialist
 */
export const Role = {
  STUDENT: 'student',
  ADMIN: 'admin',
  SCANNER: 'scanner'
};