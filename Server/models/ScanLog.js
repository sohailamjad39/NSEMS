/**
 * NSEMS/Server/models/ScanLog.js
 * 
 * Scan log schema for offline verification tracking
 * 
 * Security: 
 *   - Time-bound validation metadata
 *   - CRDT-ready for conflict resolution
 *   - Sub-100ms validation via precomputed fields
 * 
 * Relationships:
 *   - 1:1 with User (as scanner)
 *   - 1:1 with Student (as scanned)
 */
const mongoose = require('mongoose');

const ScanLogSchema = new mongoose.Schema({
  // Scanner identity
  scannerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Scanner ID is required']
  },
  
  // Scanned student
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required']
  },
  
  // Time-bound validation data
  scannedTimeWindow: {
    type: Number,
    required: [true, 'Scanned time window is required']
  },
  scannedToken: {
    type: String,
    required: [true, 'Scanned token is required']
  },
  validationStatus: {
    type: String,
    enum: ['valid', 'expired', 'invalid'],
    required: [true, 'Validation status is required']
  },
  
  // Performance metadata
  validationTime: {
    type: Number,
    required: [true, 'Validation time (ms) is required'],
    min: [0, 'Invalid validation time'],
    max: [100, 'Validation exceeded 100ms threshold'] // Critical for requirements
  },
  
  // Offline-first sync
  isSynced: {
    type: Boolean,
    default: false
  },
  conflictVersion: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Audit trail
  timestamp: {
    type: Date,
    default: Date.now,
    required: [true, 'Scan timestamp is required']
  },
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for sub-100ms query performance
ScanLogSchema.index({ timestamp: -1 });
ScanLogSchema.index({ scannerId: 1, timestamp: -1 });
ScanLogSchema.index({ 
  scannedTimeWindow: 1, 
  validationStatus: 1 
}); // Critical for time-based validation

// Pre-save hook for time validation
ScanLogSchema.pre('validate', function(next) {
  if (this.validationTime > 100) {
    return next(new Error('Validation time exceeded 100ms threshold'));
  }
  next();
});

module.exports = mongoose.model('ScanLog', ScanLogSchema);