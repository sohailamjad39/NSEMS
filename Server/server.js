/**
 * NSEMS/Server/server.js
 * 
 * Main server entry point for the digital student ID system
 * 
 * Features:
 * - Express.js server setup
 * - MongoDB connection
 * - Route organization
 * - Middleware configuration
 * - CORS setup for local development and ngrok
 * - Health check endpoint
 * 
 * Security Notes:
 * - CORS restricted to specific origins
 * - Environment variables for sensitive data
 * - Error handling middleware
 * - Helmet.js for security headers (ready to enable)
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import scannerRoutes from './routes/scannerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import studentRoutes from './routes/studentRoutes.js';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * MongoDB Connection
 * 
 * Connects to MongoDB using environment variable DB_URI
 * Exits process on connection failure
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ MongoDB connected successfully');
    console.log(`💡 Database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();

/**
 * Middleware Configuration
 * 
 * Order of middleware is critical:
 * 1. CORS (cross-origin requests)
 * 2. Body parsers (JSON, URL-encoded)
 * 3. Security headers (Helmet - commented for development)
 * 4. Compression (gzip responses)
 * 5. Logging (request logging)
 */
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://nsems.vercel.app",
        process.env.CLIENT_URL,
      ];

      // allow requests with no origin (like mobile apps, curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Route Configuration
 * 
 * All routes are prefixed with /api for clarity
 * Order matters - more specific routes first
 */
app.use('/api/auth', authRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/students', studentRoutes);
app.use("/api/admins", adminRoutes);

/**
 * Health Check Endpoint
 * 
 * Returns server status and database connection status
 * Useful for monitoring and debugging
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * Root Endpoint
 * 
 * Returns API information and available endpoints
 */
app.get('/', (req, res) => {
  res.json({
    name: 'NSEMS Digital Student ID System',
    version: '1.0.0',
    description: 'Secure, offline-capable digital student ID verification system',
    endpoints: {
      auth: '/api/auth/login',
      scanner: '/api/scanner/validate',
      health: '/health'
    },
    documentation: 'Contact system administrator for API documentation'
  });
});

/**
 * 404 Handler
 * 
 * Catches all unmatched routes and returns 404
 */
app.use(notFoundHandler);

/**
 * Error Handler
 * 
 * Centralized error handling for all routes
 * Must be last middleware
 */
app.use(errorHandler);

/**
 * Start Server
 * 
 * Binds to 0.0.0.0 to allow LAN access
 * Logs server information on startup
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   🎓 NSEMS Digital Student ID System                      ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║   ✅ Server running on port ${PORT}`.padEnd(58, ' ') + '║');
  console.log(`║   🌐 Local: http://localhost:${PORT}`.padEnd(58, ' ') + '║');
  console.log(`║   📡 Network: http://${getIPAddress()}:${PORT}`.padEnd(58, ' ') + '║');
  console.log(`║   🛡️  Environment: ${process.env.NODE_ENV || 'development'}`.padEnd(58, ' ') + '║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
});

/**
 * Get local IP address for network access
 * 
 * @returns {string} - Local IP address or '0.0.0.0'
 */
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return '0.0.0.0';
}

export default app;