/**
 * NSEMS/Server/seedUsers.js
 *
 * Seeds 3 students + 3 admins into MongoDB
 * Run with: node seedUsers.js
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const importedUser = require('./models/User');
const User = importedUser.default || importedUser;

/* ======================
   MongoDB Connection
====================== */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ MongoDB connected (seeder)');
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
    process.exit(1);
  }
};

/* ======================
   Helper: cryptoKey
====================== */
const generateCryptoKey = () =>
  crypto.randomBytes(32).toString('hex');

/* ======================
   Seed Data
====================== */
const users = [
  // ---------- STUDENTS ----------
  {
    email: 'student1@nutech.edu',
    phone: '+923001111111',
    password: 'student123',
    role: 'student',
    cryptoKey: generateCryptoKey()
  },
  {
    email: 'student2@nutech.edu',
    phone: '+923002222222',
    password: 'student123',
    role: 'student',
    cryptoKey: generateCryptoKey()
  },
  {
    email: 'student3@nutech.edu',
    phone: '+923003333333',
    password: 'student123',
    role: 'student',
    cryptoKey: generateCryptoKey()
  },

  // ---------- ADMINS ----------
  {
    email: 'admin1@nutech.edu',
    phone: '+923004444444',
    password: 'admin123',
    role: 'admin',
    cryptoKey: generateCryptoKey()
  },
  {
    email: 'admin2@nutech.edu',
    phone: '+923005555555',
    password: 'admin123',
    role: 'admin',
    cryptoKey: generateCryptoKey()
  },
  {
    email: 'admin3@nutech.edu',
    phone: '+923006666666',
    password: 'admin123',
    role: 'admin',
    cryptoKey: generateCryptoKey()
  }
];

/* ======================
   Seeder Runner
====================== */
const seedUsers = async () => {
  try {
    await connectDB();

    // Clean previous users (optional but recommended)
    await User.deleteMany({});
    console.log('🧹 Existing users cleared');

    // Insert new users
    await User.insertMany(users);
    console.log('🌱 Users seeded successfully');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
};

seedUsers();