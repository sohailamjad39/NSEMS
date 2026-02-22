/**
 * NSEMS/Server/models/User.js
 * 
 * Complete User model with proper role handling and student ID validation
 * 
 * Security Notes:
 * - Student ID format validation (NSE-202601)
 * - Password never exposed to clients
 * - Proper indexing for fast lookups
 * - Role-based field requirements
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  // Core authentication fields
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  password: {
    type: String,
    required: true,
    select: false, // Never expose in queries
    minlength: 8
  },
  
  // Role-based access control
  role: {
    type: String,
    enum: ['student', 'admin', 'scanner'],
    default: 'student',
    required: true
  },
  
  // Student-specific fields (required only for students)
  studentId: {
    type: String,
    required: function() { 
      return this.role === 'student'; 
    },
    unique: true,
    match: [/^[A-Z]{3}-\d{6}$/, 'Invalid student ID format (e.g., NSE-202601)'],
    trim: true,
    uppercase: true
  },
  
  // Display name (required for all roles)
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Account status
  status: {
    type: String,
    enum: ['active', 'suspended', 'graduated'],
    default: 'active'
  },
  
  // Audit trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastLogin: {
    type: Date
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for sub-10ms lookups
UserSchema.index({ studentId: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1 });

// Pre-save hook to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    // next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);