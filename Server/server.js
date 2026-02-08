/**
 * NSEMS/Server/server.js
 * 
 * Fixed server that uses authController.js (real authentication)
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { login } from './controllers/authController.js'; // ✅ Fixed import

const app = express();
const PORT = process.env.PORT || 5000;

/* ======================
   MongoDB Connection
====================== */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();

/* ======================
   Middleware
====================== */
app.use(cors({
  origin: ['http://localhost:5173', 'https://nutech.edu'], // ✅ Fixed extra spaces
  credentials: true
}));
app.use(express.json());

/* ======================
   Routes
====================== */
// ✅ Real authentication route (uses authController.js)
app.post('/api/auth/login', login);

/* ======================
   Health Check
====================== */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

/* ======================
   Start Server
====================== */
app.listen(PORT, () => {
  console.log(`✅ Login server running on port ${PORT}`);
  console.log(`💡 Real authentication enabled (uses authController.js)`);
});