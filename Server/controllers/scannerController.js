// Server/controllers/scannerController.js
import crypto from 'crypto';
import Student from '../models/Student.js';

export const validateQR = async (req, res) => {
  const { qrData, scannerId } = req.body;

  if (!qrData || typeof qrData !== 'string') {
    return res.status(400).json({
      success: false,
      valid: false,
      message: 'Invalid QR data'
    });
  }

  try {
    // Parse QR data (format: studentId|timeWindow|hmacToken)
    const parts = qrData.trim().split('|');
    if (parts.length !== 3) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid QR format (expected: studentId|timeWindow|token)'
      });
    }

    const [studentId, timeWindowStr, token] = parts;
    const timeWindow = parseInt(timeWindowStr, 10);

    if (isNaN(timeWindow) || timeWindow <= 0) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid time window'
      });
    }

    // Validate time window (60-second rotation)
    const currentTimeWindow = Math.floor(Date.now() / 60000);
    const timeDiff = Math.abs(currentTimeWindow - timeWindow);

    if (timeDiff > 1) {
      return res.status(400).json({
        success: true,
        valid: false,
        message: 'QR code expired',
        expiresAt: (timeWindow + 1) * 60000
      });
    }

    // Find student by studentId
    const studentRecord = await Student.findOne({ studentId }).populate('userId');
    if (!studentRecord) {
      return res.status(404).json({
        success: true,
        valid: false,
        message: 'Student not found'
      });
    }

    // Check student status
    if (studentRecord.academicDetails.status !== 'active') {
      return res.status(403).json({
        success: true,
        valid: false,
        message: 'Student account is not active'
      });
    }

    // Get secret key (never exposed to frontend normally, but needed for validation)
    const studentWithSecret = await Student.findById(studentRecord._id).select('+secretKey');
    if (!studentWithSecret || !studentWithSecret.secretKey) {
      return res.status(500).json({
        success: false,
        valid: false,
        message: 'Student secret key missing'
      });
    }

    // Verify HMAC token
    const expectedToken = crypto
      .createHmac('sha256', studentWithSecret.secretKey)
      .update(`${studentId}|${timeWindow}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken)
    );

    const validationStartTime = Date.now();
    const validationTime = Date.now() - validationStartTime;

    // Log scan attempt (you'll need to implement ScanLog model)
    // await ScanLog.create({
    //   scannerId: scannerId || 'unknown',
    //   studentId: studentWithSecret._id,
    //   scannedTimeWindow: timeWindow,
    //   scannedToken: token,
    //   validationStatus: isValid ? 'valid' : 'invalid',
    //   validationTime: validationTime,
    //   timestamp: new Date()
    // });

    if (!isValid) {
      return res.status(403).json({
        success: true,
        valid: false,
        message: 'Invalid QR token'
      });
    }

    // Return student information
    res.json({
      success: true,
      valid: true,
      student: {
        id: studentWithSecret.studentId,
        name: studentWithSecret.name,
        program: studentWithSecret.academicDetails.program,
        department: studentWithSecret.academicDetails.department,
        year: studentWithSecret.academicDetails.year,
        status: studentWithSecret.academicDetails.status
      },
      timestamp: Date.now(),
      expiresIn: (timeWindow + 1) * 60000 - Date.now()
    });

  } catch (error) {
    console.error('QR validation error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error during validation'
    });
  }
};