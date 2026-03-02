/**
 * NSEMS/Server/server.js
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";
import scannerRoutes from "./routes/scannerRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import studentRoutes from "./routes/studentRoutes.js";
import os from "os";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("✅ MongoDB connected successfully");
    console.log(`💡 Database: ${mongoose.connection.db.databaseName}`);
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};
connectDB();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// FIX: building the allowed list from env vars at startup can include
// `undefined` if a variable isn't set — that breaks CORS entirely.
// Use a function-based origin check instead, which is evaluated per-request
// and handles missing vars gracefully.

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://localhost:3000",
];

// Add CLIENT_URL from env only if it's actually set
if (process.env.CLIENT_URL) {
  ALLOWED_ORIGINS.push(process.env.CLIENT_URL);
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any *.vercel.app subdomain (covers preview deployments too)
      if (origin.endsWith(".vercel.app")) return callback(null, true);

      // Allow explicitly listed origins
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

      // Block everything else
      console.warn(`🚫 CORS blocked: ${origin}`);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Explicitly handle OPTIONS preflight for all routes
app.options("*", cors());

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/scanner",  scannerRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/admins",   adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:      "ok",
    timestamp:   new Date().toISOString(),
    uptime:      process.uptime(),
    database:    mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/", (req, res) => {
  res.json({
    name:    "NSEMS Digital Student ID System",
    version: "1.0.0",
  });
});

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log("╔═════════════════════════════════════════════════════════════════════════════════╗");
  console.log("║   🎓 NSEMS Digital Student ID System                                            ║");
  console.log("╠═════════════════════════════════════════════════════════════════════════════════╣");
  console.log(`║   ✅ Server running on port ${PORT}`.padEnd(58, " ") + "════════════════════════║");
  console.log(`║   🌐 Local: http://localhost:${PORT}`.padEnd(58, " ") + "═══════════════════════║");
  console.log(`║   📡 Network: http://${getIPAddress()}:${PORT}`.padEnd(58, " ") + "═════════════║");
  console.log(`║   🛡️  Environment: ${process.env.NODE_ENV || "development"}`.padEnd(58, " ") + "║");
  console.log(`║   🔗 Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`.padEnd(58, " ") + "═══════ ║");
  console.log("╚═════════════════════════════════════════════════════════════════════════════════╝");
});

function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "0.0.0.0";
}

export default app;