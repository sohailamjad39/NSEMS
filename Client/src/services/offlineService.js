// Client/src/services/offlineService.js
/**
 * Comprehensive offline service for NSEMS with complete student data caching
 */

class OfflineService {
  constructor() {
    this.dbName = "NSEMS_DB";
    this.version = 2; // Incremented version for schema changes
    this.dbPromise = null;
  }

  async initDB() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Login data store
          if (!db.objectStoreNames.contains("loginData")) {
            db.createObjectStore("loginData");
          }

          // Students store (complete student data)
          if (!db.objectStoreNames.contains("students")) {
            const studentsStore = db.createObjectStore("students", {
              keyPath: "studentId",
            });
            studentsStore.createIndex("secretKey", "secretKey", {
              unique: false,
            });
            studentsStore.createIndex("name", "name", { unique: false });
          }

          // Admin data store
          if (!db.objectStoreNames.contains("adminData")) {
            db.createObjectStore("adminData");
          }

          // Scan logs store
          if (!db.objectStoreNames.contains("scanLogs")) {
            const scanLogsStore = db.createObjectStore("scanLogs", {
              keyPath: "id",
              autoIncrement: true,
            });
            scanLogsStore.createIndex("timestamp", "timestamp", {
              unique: false,
            });
          }

          // Sync queue store
          if (!db.objectStoreNames.contains("syncQueue")) {
            db.createObjectStore("syncQueue", {
              keyPath: "id",
              autoIncrement: true,
            });
          }
        };
      });
    }
    return this.dbPromise;
  }

  // Store complete student data for offline validation
  async storeStudentData(studentData) {
    const db = await this.initDB();
    const tx = db.transaction("students", "readwrite");
    const store = tx.objectStore("students");
    await store.put(studentData);
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    console.log(
      "✅ Student data cached for offline validation:",
      studentData.studentId,
    );
  }

  // Get student data by studentId
  async getStudentData(studentId) {
    const db = await this.initDB();
    const tx = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    return new Promise((resolve, reject) => {
      const request = store.get(studentId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all students for admin offline access
  async getAllStudents() {
    const db = await this.initDB();
    const tx = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Store login data
  async storeLoginData(data) {
    const db = await this.initDB();
    const tx = db.transaction("loginData", "readwrite");
    const store = tx.objectStore("loginData");
    await store.put(data, "currentLogin");
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    // If student login, also cache complete student data
    if (data.role === "student") {
      await this.storeStudentData({
        studentId: data.studentId,
        name: data.name,
        secretKey: data.secretKey,
        program: data.program || "Software Engineering",
        department: data.department || "Computer Science",
        year: data.year || 3,
        status: "active",
      });
    }
  }

  // Get login data
  async getLoginData() {
    const db = await this.initDB();
    const tx = db.transaction("loginData", "readonly");
    const store = tx.objectStore("loginData");
    return new Promise((resolve, reject) => {
      const request = store.get("currentLogin");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Store admin data and sync all students
  async storeAdminData(adminData) {
    const db = await this.initDB();
    const tx = db.transaction("adminData", "readwrite");
    const store = tx.objectStore("adminData");
    await store.put(adminData, "currentAdmin");
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    // Sync all students when admin logs in
    await this.syncAllStudents();
  }

  // Sync all students from server (when online)
  async syncAllStudents() {
    try {
      const response = await fetch("/api/students/sync-all", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const students = await response.json();
        for (const student of students) {
          await this.storeStudentData(student);
        }
        console.log("✅ All students synced for offline access");
      }
    } catch (error) {
      console.warn("Failed to sync all students:", error);
    }
  }

  // Generate secure token using Web Crypto API
  async generateSecureToken(studentId, timeWindow, secretKey) {
    if (!secretKey) {
      throw new Error("Secret key required for token generation");
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(`${studentId}|${timeWindow}`);

    try {
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secretKey),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );

      const signature = await crypto.subtle.sign("HMAC", key, data);
      const hexSignature = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      return hexSignature;
    } catch (error) {
      console.error("Crypto error:", error);
      // Fallback to simple hash (shouldn't happen in production)
      const fallbackData = `${studentId}|${timeWindow}|${secretKey}`;
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(fallbackData),
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .substring(0, 64);
    }
  }

  // Validate QR code offline
  async validateQROffline(qrData) {
    try {
      // 1. Clean the input strictly
      const cleanedData = qrData.trim();
      const parts = cleanedData.split("|");
      
      if (parts.length !== 3) {
        return { success: true, valid: false, message: "Invalid QR format" };
      }

      const [studentId, timeWindowStr, token] = parts;
      const timeWindow = parseInt(timeWindowStr, 10);
      const currentTimeWindow = Math.floor(Date.now() / 60000);

      // 2. Validate time window (allow current and previous window)
      if (Math.abs(currentTimeWindow - timeWindow) > 1) {
        return { success: true, valid: false, message: "QR code expired" };
      }

      // 3. Get student data from IndexedDB
      const studentData = await this.getStudentData(studentId);
      if (!studentData) {
        return {
          success: true,
          valid: false,
          message: "Student not found in offline database",
        };
      }

      // 4. Check student status
      if (studentData.status !== "active") {
        return {
          success: true,
          valid: false,
          message: "Student account is not active",
        };
      }

      // 5. CRITICAL FIX: Ensure secret key exists before attempting crypto
      // If missing, return success:false to allow fallback to server if online
      if (!studentData.secretKey) {
        console.warn(`Offline validation failed: Missing secret key for ${studentId}`);
        return { 
          success: false, 
          valid: false, 
          message: "Offline data incomplete (missing key)" 
        };
      }

      // 6. Verify token using stored secret key
      const expectedToken = await this.generateSecureToken(
        studentId,
        timeWindow,
        studentData.secretKey,
      );

      // 7. CRITICAL FIX: Trim the token to remove scanner artifacts before comparing
      if (token.trim() !== expectedToken) {
        return { success: true, valid: false, message: "Invalid QR token" };
      }

      return {
        success: true,
        valid: true,
        student: {
          id: studentData.studentId,
          name: studentData.name,
          program: studentData.program,
          department: studentData.department,
          year: studentData.year,
          status: studentData.status,
        },
      };
    } catch (error) {
      console.error("Offline validation error:", error);
      return {
        success: false,
        valid: false,
        message: "Offline validation failed",
      };
    }
  }
}

export const offlineService = new OfflineService();

// Initialize on app startup
offlineService.initDB().catch(console.error);
