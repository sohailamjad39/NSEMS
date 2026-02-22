// Server/scripts/seedDatabase.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from '../models/User.js';
import Student from '../models/Student.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect("mongodb+srv://sohail:sohail123@testdb.k2piiiv.mongodb.net/?retryWrites=true&w=majority&appName=HRM");
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Student.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const admin = await User.create({
      email: 'admin@nutech.edu.pk',
      phone: '+923001234567',
      password: 'admin123',
      role: 'admin',
      name: 'System Administrator'
    });
    console.log('Created admin user');

    // Generate secure secret key for student
    const studentSecretKey = crypto.randomBytes(32).toString('hex');
    
    // Create student user
    const studentUser = await User.create({
      email: 'sohail@nutech.edu.pk',
      phone: '+923007654321',
      password: "student123",
      role: 'student',
      studentId: 'NSE-202601',
      name: 'Muhammad Sohail'
    });
    console.log('Created student user');

    // Create corresponding student record with REAL secret key
    const studentRecord = await Student.create({
      userId: studentUser._id,
      name: 'Muhammad Sohail',
      studentId: 'NSE-202601',
      academicDetails: {
        program: 'Software Engineering',
        department: 'Computer Science',
        year: 3,
        status: 'active'
      },
      secretKey: studentSecretKey, // ✅ REAL cryptographically secure secret key
      tokenRotation: 60000
    });
    console.log('Created student record with secure secret key');
    console.log('Student Secret Key:', studentSecretKey); // For debugging only

    console.log('✅ Database seeded successfully!');
    console.log('Admin login: admin@nutech.edu.pk / admin123');
    console.log('Student login: NSE-202601 / student123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();