/**
 * NSEMS/Server/controllers/authController.js
 * 
 * Fixed authentication controller (works with your User model)
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Login handler
export const login = async (req, res) => {
  const { identifier, password } = req.body;
  const startTime = Date.now();

  try {
    // 1. Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Generate JWT token (simplified for now - matches your frontend expectations)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_strong_jwt_secret_here',
      { expiresIn: '24h' }
    );

    // 4. Prepare response
    const response = {
      success: true,
      role: user.role,
      token,
      message: 'Login successful',
      validationTime: Date.now() - startTime
    };

    // 5. Validate sub-100ms requirement
    if (response.validationTime > 100) {
      console.warn('⚠️ Validation time exceeded 100ms:', response.validationTime, 'ms');
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Authentication failed'
    });
  }
};