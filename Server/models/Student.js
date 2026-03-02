/**
 * NSEMS/Server/models/Student.js
 *
 * FIX: Removed the hardcoded `match` validator on studentId:
 *   match: [/^[A-Z]{3}-\d{6}$/, 'Invalid student ID format (e.g., NSE-202601)']
 *
 * This was the root cause — Mongoose validates the document BEFORE .save(),
 * so no controller or frontend change could fix it. The model is the final gate.
 *
 * Also fixed: generateToken() used require('crypto') inside an ES module file.
 * crypto is now imported at the top level.
 */

import mongoose from 'mongoose';
import crypto   from 'crypto';

const StudentSchema = new mongoose.Schema({
  // Core identity (links to User)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true
  },

  // ID card data
  name: {
    type: String,
    required: [true, 'Student name is required'],
    trim: true
  },

  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    // FIXED: was match: [/^[A-Z]{3}-\d{6}$/, '...'] — strict NSE-202601 only.
    // Replaced with a permissive validator: letters, numbers, hyphens, underscores.
    validate: {
      validator: function(v) {
        return v && /^[A-Z0-9\-_]+$/i.test(v);
      },
      message: 'Student ID can only contain letters, numbers, hyphens, or underscores'
    }
  },

  academicDetails: {
    program: {
      type: String,
      required: [true, 'Academic program is required']
    },
    department: {
      type: String,
      required: [true, 'Department is required']
    },
    year: {
      type: Number,
      min: [1, 'Invalid academic year'],
      max: [10, 'Invalid academic year']
    },
    status: {
      type: String,
      enum: ['active', 'graduated', 'suspended'],
      default: 'active'
    }
  },

  // Crypto fields (critical for security)
  secretKey: {
    type: String,
    required: [true, 'Secret key is required'],
    select: false // Never exposed to clients
  },
  tokenRotation: {
    type: Number,
    default: 60_000 // 60 seconds (ms)
  },

  // Offline-first sync
  lastSync: {
    type: Date,
    default: Date.now
  },
  conflictVersion: {
    type: Number,
    default: 0,
    min: 0
  },

  // Audit trail
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for sub-100ms scan validation
StudentSchema.index({ studentId: 1 }, { unique: true });
StudentSchema.index({ 'academicDetails.status': 1 });
StudentSchema.index({ userId: 1, secretKey: 1 }); // Critical for token regeneration

// Virtual for time-bound token
StudentSchema.virtual('currentToken').get(function() {
  const window = Math.floor(Date.now() / this.tokenRotation);
  return this.generateToken(window);
});

// Token generation — FIXED: use top-level import, not require() (ES module file)
StudentSchema.methods.generateToken = function(timeWindow) {
  return crypto
    .createHmac('sha256', this.secretKey)
    .update(String(timeWindow))
    .digest('hex');
};

const Student = mongoose.model('Student', StudentSchema);
export default Student;