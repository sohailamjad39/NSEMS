// Server/controllers/scannerController.js
import crypto from 'crypto';
import Student from '../models/Student.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// ── Inline ScanLog model (avoids adding a new file if ScanLog.js uses require) ──
let ScanLog;
try {
  ScanLog = mongoose.model('ScanLog');
} catch {
  const ScanLogSchema = new mongoose.Schema({
    scannerId:         { type: String, default: 'unknown' },
    studentObjectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    studentId:         { type: String },
    studentName:       { type: String },
    scannedTimeWindow: { type: Number },
    scannedToken:      { type: String },
    validationStatus:  { type: String, enum: ['valid', 'expired', 'invalid'], default: 'invalid' },
    validationTime:    { type: Number, default: 0 },
    isSynced:          { type: Boolean, default: true },
    timestamp:         { type: Date, default: Date.now },
  }, { timestamps: true });
  ScanLog = mongoose.model('ScanLog', ScanLogSchema);
}

export const validateQR = async (req, res) => {
  const { qrData, scannerId } = req.body;
  const validationStart = Date.now();

  if (!qrData || typeof qrData !== 'string') {
    return res.status(400).json({ success: false, valid: false, message: 'Invalid QR data' });
  }

  try {
    const parts = qrData.trim().split('|');
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false, valid: false,
        message: 'Invalid QR format (expected: studentId|timeWindow|token)'
      });
    }

    const [studentId, timeWindowStr, token] = parts;
    const timeWindow = parseInt(timeWindowStr, 10);

    if (isNaN(timeWindow) || timeWindow <= 0) {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid time window' });
    }

    const currentTimeWindow = Math.floor(Date.now() / 60000);
    const timeDiff = Math.abs(currentTimeWindow - timeWindow);

    if (timeDiff > 1) {
      // Log expired scan
      await ScanLog.create({
        scannerId: scannerId || 'unknown',
        studentId,
        scannedTimeWindow: timeWindow,
        scannedToken: token,
        validationStatus: 'expired',
        validationTime: Date.now() - validationStart,
      }).catch(() => {});

      return res.status(400).json({
        success: true, valid: false,
        message: 'QR code expired',
        expiresAt: (timeWindow + 1) * 60000
      });
    }

    const studentRecord = await Student.findOne({ studentId });
    if (!studentRecord) {
      await ScanLog.create({
        scannerId: scannerId || 'unknown',
        studentId,
        scannedTimeWindow: timeWindow,
        scannedToken: token,
        validationStatus: 'invalid',
        validationTime: Date.now() - validationStart,
      }).catch(() => {});

      return res.status(404).json({ success: true, valid: false, message: 'Student not found' });
    }

    if (studentRecord.academicDetails.status !== 'active') {
      return res.status(403).json({ success: true, valid: false, message: 'Student account is not active' });
    }

    const studentWithSecret = await Student.findById(studentRecord._id).select('+secretKey');
    if (!studentWithSecret || !studentWithSecret.secretKey) {
      return res.status(500).json({ success: false, valid: false, message: 'Student secret key missing' });
    }

    const expectedToken = crypto
      .createHmac('sha256', studentWithSecret.secretKey)
      .update(`${studentId}|${timeWindow}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
    const validationTime = Date.now() - validationStart;

    // Fetch user for imageLink
    const userRecord = await User.findOne({ studentId }).select('imageLink').lean();
    const imageLink = userRecord?.imageLink || '';

    // Save scan log
    await ScanLog.create({
      scannerId: scannerId || 'unknown',
      studentObjectId: studentWithSecret._id,
      studentId,
      studentName: studentWithSecret.name,
      scannedTimeWindow: timeWindow,
      scannedToken: token,
      validationStatus: isValid ? 'valid' : 'invalid',
      validationTime,
    }).catch((e) => console.warn('ScanLog save failed:', e.message));

    if (!isValid) {
      return res.status(403).json({ success: true, valid: false, message: 'Invalid QR token' });
    }

    res.json({
      success: true,
      valid: true,
      student: {
        id: studentWithSecret.studentId,
        name: studentWithSecret.name,
        program: studentWithSecret.academicDetails.program,
        department: studentWithSecret.academicDetails.department,
        year: studentWithSecret.academicDetails.year,
        status: studentWithSecret.academicDetails.status,
        imageLink,
      },
      timestamp: Date.now(),
      expiresIn: (timeWindow + 1) * 60000 - Date.now(),
    });

  } catch (error) {
    console.error('QR validation error:', error);
    res.status(500).json({ success: false, valid: false, message: 'Server error during validation' });
  }
};

// GET /api/scanner/logs  — scan logs with pagination
export const getScanLogs = async (req, res) => {
  try {
    const { limit = 50, page = 1, today = false } = req.query;
    const query = {};

    if (today === 'true') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end   = new Date(); end.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: start, $lte: end };
    }

    const logs = await ScanLog.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total         = await ScanLog.countDocuments(query);
    const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd      = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayTotal    = await ScanLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd } });
    const todayValid    = await ScanLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd }, validationStatus: 'valid' });
    const todayInvalid  = await ScanLog.countDocuments({ timestamp: { $gte: todayStart, $lte: todayEnd }, validationStatus: { $in: ['invalid', 'expired'] } });

    res.json({
      success: true,
      logs,
      total,
      todayTotal,
      todayValid,
      todayInvalid,
    });
  } catch (error) {
    console.error('Get scan logs error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching scan logs' });
  }
};

// POST /api/scanner/sync-logs  — sync offline logs
export const syncLogs = async (req, res) => {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.json({ success: true, synced: 0 });
    }

    let synced = 0;
    for (const log of logs) {
      try {
        await ScanLog.create({
          scannerId:         log.scannerId || 'offline',
          studentId:         log.studentId || '',
          studentName:       log.name || '',
          scannedTimeWindow: log.timeWindow || 0,
          scannedToken:      log.token || '',
          validationStatus:  log.status === 'verified' ? 'valid' : (log.status === 'expired' ? 'expired' : 'invalid'),
          validationTime:    log.validationTime || 0,
          timestamp:         log.timestamp ? new Date(log.timestamp) : new Date(),
          isSynced:          true,
        });
        synced++;
      } catch (e) {
        console.warn('Failed to sync log entry:', e.message);
      }
    }

    res.json({ success: true, synced });
  } catch (error) {
    console.error('Sync logs error:', error);
    res.status(500).json({ success: false, message: 'Server error during log sync' });
  }
};