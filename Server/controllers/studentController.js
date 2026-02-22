/**
 * NSEMS/Server/controllers/studentController.js
 * 
 * Student registration controller with automatic secret key generation
 * 
 * Features:
 * - Secure student registration by admin only
 * - Automatic secret key generation using crypto
 * - Proper User-Student relationship linking
 * - Input validation and error handling
 * - Password hashing for security
 */

import crypto from 'crypto';
import User from '../models/User.js';
import Student from '../models/Student.js';

/**
 * Register a new student (admin only)
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * 
 * Request Body:
 *   - email: Student email
 *   - phone: Student phone number
 *   - password: Student password
 *   - name: Student full name
 *   - studentId: Student ID (format: XXX-XXXXXX)
 *   - program: Academic program
 *   - department: Department name
 *   - year: Academic year
 * 
 * Response:
 *   - success: boolean
 *   - message: Success or error message
 *   - studentId: Created student ID
 */
export const registerStudent = async (req, res) => {
  try {
    const {
      email,
      phone,
      password,
      name,
      studentId,
      program,
      department,
      year
    } = req.body;

    // Input validation
    if (!email || !phone || !password || !name || !studentId || !program || !department || !year) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate student ID format
    const studentIdRegex = /^[A-Z]{3}-\d{6}$/;
    if (!studentIdRegex.test(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID format (e.g., NSE-202601)'
      });
    }

    // Validate year
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1 || yearNum > 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid academic year (1-10)'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }, { studentId }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email, phone, or student ID'
      });
    }


    // Generate secure secret key for QR code generation
    const secretKey = crypto.randomBytes(32).toString('hex');

    // Create user record
    const user = await User.create({
      email,
      phone,
      password,
      role: 'student',
      studentId,
      name
    });

    // Create student record with secret key
    const student = await Student.create({
      userId: user._id,
      name,
      studentId,
      academicDetails: {
        program,
        department,
        year: yearNum,
        status: 'active'
      },
      secretKey,
      tokenRotation: 60000
    });

    console.log(`✅ Student registered successfully: ${studentId}`);
    console.log(`🔑 Secret key generated for: ${studentId}`);

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      studentId: student.studentId
    });

  } catch (error) {
    console.error('Student registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate email, phone, or student ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during student registration'
    });
  }
};

/**
 * Get all students (admin only)
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select('name studentId academicDetails')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      students
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students'
    });
  }
};

export const syncAllStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select('studentId name academicDetails secretKey')
      .lean(); // Use lean() for better performance

    const formattedStudents = students.map(student => ({
      studentId: student.studentId,
      name: student.name,
      secretKey: student.secretKey,
      program: student.academicDetails.program,
      department: student.academicDetails.department,
      year: student.academicDetails.year,
      status: student.academicDetails.status
    }));

    res.json(formattedStudents);
  } catch (error) {
    console.error('Sync all students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while syncing students'
    });
  }
};