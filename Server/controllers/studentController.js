/**
 * NSEMS/Server/controllers/studentController.js
 *
 * Fixes applied vs your original:
 *
 *  BUG 1 — getAllStudentsDetails (caused the 500):
 *    $unwind had `preserveNullAndEmpty: true` which is NOT a valid MongoDB option.
 *    The correct option is `preserveNullAndEmptyArrays: true`.
 *    MongoDB silently ignores unknown $unwind options and then crashes on the
 *    subsequent $project because $user fields are undefined.
 *    ALSO: the $project referenced flat fields ($program, $department, etc.)
 *    but the schema stores them nested under academicDetails — fixed to
 *    $academicDetails.program etc.
 *
 *  BUG 2 — updateStudent / deleteStudent:
 *    Both used `const User = require("../models/User")` inside an ES module
 *    file (import/export syntax). require() is not available in ES modules and
 *    throws "require is not defined". Fixed by using the User already imported
 *    at the top of the file.
 *    ALSO: updateStudent wrote to flat Student fields (student.program = ...)
 *    but the schema uses academicDetails.program — those assignments were
 *    silently ignored and nothing ever saved. Fixed to $set academicDetails.*.
 */

import crypto from 'crypto';
import User    from '../models/User.js';
import Student from '../models/Student.js';

// ─── REGISTER ────────────────────────────────────────────────────────────────
export const registerStudent = async (req, res) => {
  try {
    const { email, phone, password, name, studentId, program, department, year } = req.body;

    if (!email || !phone || !password || !name || !studentId || !program || !department || !year) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Allow any alphanumeric student ID — no strict format enforced
    const cleanStudentId = studentId.trim().toUpperCase();
    if (!/^[A-Z0-9\-_]+$/i.test(cleanStudentId)) {
      return res.status(400).json({ success: false, message: 'Student ID can only contain letters, numbers, hyphens, or underscores' });
    }

    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1 || yearNum > 10) {
      return res.status(400).json({ success: false, message: 'Invalid academic year (1-10)' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }, { studentId }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists with this email, phone, or student ID' });
    }

    const secretKey = crypto.randomBytes(32).toString('hex');
    const user      = await User.create({ email, phone, password, role: 'student', studentId: cleanStudentId, name });

    const student = await Student.create({
      userId:          user._id,
      name,
      studentId: cleanStudentId,
      academicDetails: { program, department, year: yearNum, status: 'active' },
      secretKey,
      tokenRotation:   60000,
    });

    console.log(`✅ Student registered: ${studentId}`);
    return res.status(201).json({
      success:   true,
      message:   'Student registered successfully',
      studentId: student.studentId,
    });

  } catch (error) {
    console.error('registerStudent error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate email, phone, or student ID' });
    }
    return res.status(500).json({ success: false, message: 'Server error during student registration' });
  }
};

// ─── GET ALL STUDENTS (basic list) ───────────────────────────────────────────
export const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select('name studentId academicDetails')
      .sort({ createdAt: -1 });

    return res.json({ success: true, students });
  } catch (error) {
    console.error('getAllStudents error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching students' });
  }
};

// ─── SYNC ALL STUDENTS (offline cache for scanner) ────────────────────────────
export const syncAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select('studentId name academicDetails secretKey userId')
      .lean();

    const studentIds = students.map(s => s.studentId);
    const users = await User.find({ studentId: { $in: studentIds } })
      .select('studentId imageLink')
      .lean();

    const userImageMap = {};
    users.forEach(u => { userImageMap[u.studentId] = u.imageLink || ''; });

    const formatted = students.map(s => ({
      studentId:  s.studentId,
      name:       s.name,
      secretKey:  s.secretKey,
      program:    s.academicDetails?.program    || '',
      department: s.academicDetails?.department || '',
      year:       s.academicDetails?.year       ?? '',
      status:     s.academicDetails?.status     || 'active',
      imageLink:  userImageMap[s.studentId]     || '',
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('syncAllStudents error:', error);
    return res.status(500).json({ success: false, message: 'Server error while syncing students' });
  }
};

// ─── STUDENT STATS ────────────────────────────────────────────────────────────
export const getStudentStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalAdmins   = await User.countDocuments({ role: { $in: ['admin', 'scanner'] } });

    return res.json({ success: true, totalStudents, totalAdmins });
  } catch (error) {
    console.error('getStudentStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── GET ALL STUDENTS WITH FULL DETAILS (admin page) ─────────────────────────
export const getAllStudentsDetails = async (req, res) => {
  try {
    const students = await Student.aggregate([
      {
        $lookup: {
          from:         'users',   // MongoDB collection name (lowercase, plural)
          localField:   'userId',
          foreignField: '_id',
          as:           'user',
        },
      },
      {
        $unwind: {
          path:                       '$user',
          preserveNullAndEmptyArrays: true,   // ← FIXED (was: preserveNullAndEmpty — invalid)
        },
      },
      {
        $project: {
          _id:       0,
          studentId: 1,
          name:      1,
          // ↓ FIXED: schema uses academicDetails.* not flat top-level fields
          program:    '$academicDetails.program',
          department: '$academicDetails.department',
          year:       '$academicDetails.year',
          status:     '$academicDetails.status',
          // from the joined user document
          email:     '$user.email',
          phone:     '$user.phone',
          imageLink: { $ifNull: ['$user.imageLink', ''] },
        },
      },
      { $sort: { name: 1 } },
    ]);

    return res.json({ success: true, students });
  } catch (err) {
    console.error('getAllStudentsDetails error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE STUDENT ───────────────────────────────────────────────────────────
export const updateStudent = async (req, res) => {
  try {
    const { studentId }                                              = req.params;
    const { name, email, phone, program, department, year, status, imageLink } = req.body;

    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Build $set for the Student document.
    // FIXED: write to academicDetails.* (nested) not flat fields — the schema
    // stores program/department/year/status inside the academicDetails subdoc.
    const studentSet = {};
    if (name       !== undefined) studentSet.name                          = name;
    if (program    !== undefined) studentSet['academicDetails.program']    = program;
    if (department !== undefined) studentSet['academicDetails.department'] = department;
    if (year       !== undefined) studentSet['academicDetails.year']       = Number(year);
    if (status     !== undefined) studentSet['academicDetails.status']     = status;

    if (Object.keys(studentSet).length > 0) {
      await Student.findOneAndUpdate({ studentId }, { $set: studentSet });
    }

    // Build $set for the User document (email, phone, imageLink, name).
    // FIXED: use the imported User — NOT require() (invalid in ES modules)
    const userSet = {};
    if (name      !== undefined) userSet.name      = name;
    if (email     !== undefined) userSet.email     = email;
    if (phone     !== undefined) userSet.phone     = phone;
    if (imageLink !== undefined) userSet.imageLink = imageLink;

    if (Object.keys(userSet).length > 0) {
      await User.findByIdAndUpdate(student.userId, { $set: userSet });
    }

    return res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    console.error('updateStudent error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE STUDENT ───────────────────────────────────────────────────────────
export const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findOneAndDelete({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // FIXED: use the imported User — NOT require() (invalid in ES modules)
    await User.findByIdAndDelete(student.userId);

    return res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};