// Server/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Student from '../models/Student.js';

export const login = async (req, res) => {
  const { identifier, password } = req.body;

  try {
    let user;
    const studentIdRegex = /^[A-Z]{3}-\d{6}$/;
    
    if (studentIdRegex.test(identifier)) {
      user = await User.findOne({ studentId: identifier }).select('+password');
    } else {
      user = await User.findOne({ 
        $or: [{ email: identifier }, { phone: identifier }] 
      }).select('+password');
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    let secretKey = null;
    let studentData = null;
    
    if (user.role === 'student') {
      studentData = await Student.findOne({ studentId: user.studentId })
        .select('studentId name academicDetails secretKey');
      
      if (!studentData) {
        return res.status(500).json({ 
          success: false,
          message: 'Student record incomplete' 
        });
      }
      secretKey = studentData.secretKey;
    }

    // ✅ Create token WITHOUT secretKey in payload (security best practice)
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        studentId: user.studentId,
        name: user.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // ✅ Use 24h, not 365d
    );

    // ✅ Send secretKey ONLY in response body, NOT in JWT token
    const responseData = { 
      success: true, 
      role: user.role, 
      token, 
      studentId: user.studentId,
      name: user.name
    };

    if (user.role === 'student') {
      responseData.secretKey = secretKey; // ✅ Secret key in response body only
      responseData.program = studentData.academicDetails.program;
      responseData.department = studentData.academicDetails.department;
      responseData.year = studentData.academicDetails.year;
      responseData.status = studentData.academicDetails.status;
    }

    // ✅ ALWAYS send 200 OK with JSON response
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Login error: ', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during authentication' 
    });
  }
};