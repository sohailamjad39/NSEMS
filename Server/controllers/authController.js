/**
 * Server/controllers/authController.js
 *
 * Fixed changePassword:
 *  - Uses bcrypt.compare() instead of === (passwords are hashed)
 *  - Looks up user by req.user.id (JWT payload) with +password select
 *  - Properly returns 401 on wrong password instead of 404
 */

import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import User   from "../models/User.js";
import Student from "../models/Student.js";

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    let user;
    // Try studentId first (if identifier is not an email — emails always contain @)
    // This supports any alphanumeric studentId format, not just XXX-XXXXXX
    if (!identifier.includes('@')) {
      user = await User.findOne({ studentId: identifier.trim().toUpperCase() }).select("+password");
    }
    // If not found by studentId, try email or phone
    if (!user) {
      user = await User.findOne({
        $or: [{ email: identifier }, { phone: identifier }],
      }).select("+password");
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    let secretKey   = null;
    let studentData = null;

    if (user.role === "student") {
      studentData = await Student.findOne({ studentId: user.studentId }).select(
        "studentId name academicDetails secretKey",
      );
      if (!studentData) {
        return res.status(500).json({ success: false, message: "Student record incomplete" });
      }
      secretKey = studentData.secretKey;
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, studentId: user.studentId, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "365d" },
    );

    const responseData = {
      success:   true,
      role:      user.role,
      token,
      studentId: user.studentId,
      name:      user.name,
      imageLink: user.imageLink || "",
    };

    if (user.role === "student") {
      responseData.secretKey  = secretKey;
      responseData.program    = studentData.academicDetails.program;
      responseData.department = studentData.academicDetails.department;
      responseData.year       = studentData.academicDetails.year;
      responseData.status     = studentData.academicDetails.status;
      responseData.imageLink  = user.imageLink || "";
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error during authentication" });
  }
};

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
// POST /api/auth/change-password   (requires Bearer token via authMiddleware)
//
// Fixes vs previous version:
//  1. Looks up user by req.user.id (the `id` field stored in JWT, not `_id`)
//     and explicitly selects +password so the hashed value is available.
//  2. Uses bcrypt.compare() — never compare plaintext to a bcrypt hash with ===.
//  3. Saves only the NEW plain-text password; the User model's pre-save hook
//     will bcrypt-hash it before writing to the DB.
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both passwords are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must differ from current password" });
    }

    // req.user is the decoded JWT payload — use its `id` field
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Select +password explicitly because the schema has `select: false`
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // FIX: compare with bcrypt, NOT with ===
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // Assign plain-text; the pre-save hook on User.js will hash it
    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};