/**
 * Client/src/services/offlineService.js
 *
 * ADDITIONS in this version (no existing logic changed):
 * - cacheScanLogs / getCachedScanLogs / cacheScanLogsAll / getCachedScanLogsAll
 *     → persist ScanLogs page data to IndexedDB for offline viewing
 * - cacheAdmins / getCachedAdmins
 *     → persist ManageAdmins page data to IndexedDB for offline viewing
 * - getStudentImage — retrieve cached student photo (base64 data-URL)
 * - getDashboardStats / storeDashboardStats — already referenced by AdminDashboard
 * - DB version bumped to 4 to add cachedScanLogs + cachedAdmins stores
 */

class OfflineService {
  constructor() {
    this.dbName    = "NSEMS_DB";
    this.version   = 4;
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

          if (!db.objectStoreNames.contains("loginData"))
            db.createObjectStore("loginData");

          if (!db.objectStoreNames.contains("students")) {
            const s = db.createObjectStore("students", { keyPath: "studentId" });
            s.createIndex("secretKey", "secretKey", { unique: false });
            s.createIndex("name",      "name",      { unique: false });
          }

          if (!db.objectStoreNames.contains("adminData"))
            db.createObjectStore("adminData");

          if (!db.objectStoreNames.contains("scanLogs")) {
            const sl = db.createObjectStore("scanLogs", { keyPath: "id", autoIncrement: true });
            sl.createIndex("timestamp", "timestamp", { unique: false });
          }

          if (!db.objectStoreNames.contains("syncQueue"))
            db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });

          // Student photo cache (base64 data-URLs keyed by studentId)
          if (!db.objectStoreNames.contains("studentImages"))
            db.createObjectStore("studentImages");

          // Dashboard stats
          if (!db.objectStoreNames.contains("dashboardStats"))
            db.createObjectStore("dashboardStats");

          // NEW v4: cached scan logs for ScanLogs page
          if (!db.objectStoreNames.contains("cachedScanLogs"))
            db.createObjectStore("cachedScanLogs");

          // NEW v4: cached admins list for ManageAdmins page
          if (!db.objectStoreNames.contains("cachedAdmins"))
            db.createObjectStore("cachedAdmins");
        };
      });
    }
    return this.dbPromise;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  async _get(storeName, key) {
    try {
      const db    = await this.initDB();
      const tx    = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror   = () => resolve(null);
      });
    } catch { return null; }
  }

  async _put(storeName, key, value) {
    try {
      const db    = await this.initDB();
      const tx    = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put(value, key);
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    } catch (e) { console.warn(`_put(${storeName}) failed:`, e.message); }
  }

  // ── Student data ──────────────────────────────────────────────────────────

  async storeStudentData(studentData) {
    const db    = await this.initDB();
    const tx    = db.transaction("students", "readwrite");
    const store = tx.objectStore("students");
    const existing = await new Promise((res) => {
      const r = store.get(studentData.studentId);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => res(null);
    });
    const merged = { ...(existing || {}), ...studentData };
    store.put(merged);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    console.log("✅ Student cached:", studentData.studentId);
    if (studentData.imageLink) {
      this.cacheStudentImage(studentData.studentId, studentData.imageLink).catch(() => {});
    }
  }

  async getStudentData(studentId) {
    const db    = await this.initDB();
    const tx    = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    return new Promise((resolve, reject) => {
      const req = store.get(studentId);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async getAllStudents() {
    const db    = await this.initDB();
    const tx    = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Image caching ─────────────────────────────────────────────────────────

  async cacheStudentImage(studentId, imageUrl) {
    if (!imageUrl) return null;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob   = await response.blob();
      const base64 = await new Promise((res) => {
        const reader = new FileReader();
        reader.onloadend = () => res(reader.result);
        reader.readAsDataURL(blob);
      });
      await this._put("studentImages", studentId, base64);
      return base64;
    } catch (e) {
      console.warn("Image cache failed for", studentId, e.message);
      return null;
    }
  }

  async getStudentImage(studentId) {
    return this._get("studentImages", studentId);
  }

  // ── Login / Admin data ────────────────────────────────────────────────────

  async storeLoginData(data) {
    const db    = await this.initDB();
    const tx    = db.transaction("loginData", "readwrite");
    const store = tx.objectStore("loginData");
    store.put(data, "currentLogin");
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    if (data.role === "student") {
      await this.storeStudentData({
        studentId:  data.studentId,
        name:       data.name,
        secretKey:  data.secretKey,
        program:    data.program    || "Software Engineering",
        department: data.department || "Computer Science",
        year:       data.year       || 3,
        status:     "active",
        imageLink:  data.imageLink  || "",
      });
    }
  }

  async getLoginData() {
    const db    = await this.initDB();
    const tx    = db.transaction("loginData", "readonly");
    const store = tx.objectStore("loginData");
    return new Promise((resolve, reject) => {
      const req = store.get("currentLogin");
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async storeAdminData(adminData) {
    const db    = await this.initDB();
    const tx    = db.transaction("adminData", "readwrite");
    const store = tx.objectStore("adminData");
    store.put(adminData, "currentAdmin");
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
    await this.syncAllStudents();
  }

  // ── Dashboard stats ───────────────────────────────────────────────────────

  async storeDashboardStats(stats) {
    await this._put("dashboardStats", "stats", { ...stats, cachedAt: Date.now() });
  }

  async getDashboardStats() {
    return this._get("dashboardStats", "stats");
  }

  // ── Scan log cache ────────────────────────────────────────────────────────
  // Used by AdminDashboard after fetching; ScanLogs page reads this when offline.

  async cacheScanLogs(logs) {
    await this._put("cachedScanLogs", "today", { logs, cachedAt: Date.now() });
  }

  async getCachedScanLogs() {
    const entry = await this._get("cachedScanLogs", "today");
    return entry ? entry.logs : null;
  }

  async cacheScanLogsAll(logs) {
    await this._put("cachedScanLogs", "all", { logs, cachedAt: Date.now() });
  }

  async getCachedScanLogsAll() {
    const entry = await this._get("cachedScanLogs", "all");
    return entry ? entry.logs : null;
  }

  // ── Admins cache ──────────────────────────────────────────────────────────
  // Used by ManageAdmins page to avoid re-fetching on every visit.

  async cacheAdmins(admins) {
    await this._put("cachedAdmins", "list", { admins, cachedAt: Date.now() });
  }

  async getCachedAdmins() {
    const entry = await this._get("cachedAdmins", "list");
    return entry ? entry.admins : null;
  }

  // ── Sync all students from server ─────────────────────────────────────────

  async syncAllStudents() {
    try {
      const response = await fetch("/api/students/sync-all", {
        method:  "GET",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      if (response.ok) {
        const students = await response.json();
        for (const student of students) {
          await this.storeStudentData({
            studentId:  student.studentId,
            name:       student.name,
            secretKey:  student.secretKey,
            program:    student.program,
            department: student.department,
            year:       student.year,
            status:     student.status,
            imageLink:  student.imageLink || "",
          });
        }
        console.log("✅ All students synced:", students.length);
        return students.length;
      }
    } catch (error) {
      console.warn("Failed to sync students:", error);
    }
    return 0;
  }

  // ── Offline scan log queue ────────────────────────────────────────────────

  async queueOfflineScanLog(scanEntry) {
    try {
      const existing = JSON.parse(localStorage.getItem("offlineScanQueue") || "[]");
      existing.push({ ...scanEntry, queued: true, isSynced: false });
      localStorage.setItem("offlineScanQueue", JSON.stringify(existing));
    } catch (e) { console.warn("Failed to queue offline scan:", e.message); }
  }

  getOfflineScanQueue() {
    try { return JSON.parse(localStorage.getItem("offlineScanQueue") || "[]"); }
    catch { return []; }
  }

  clearOfflineScanQueue() {
    localStorage.removeItem("offlineScanQueue");
  }

  async syncOfflineScanLogs() {
    const queue = this.getOfflineScanQueue();
    if (queue.length === 0) return 0;
    try {
      const response = await fetch("/api/scanner/sync-logs", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        body:    JSON.stringify({ logs: queue }),
      });
      if (response.ok) {
        const data = await response.json();
        this.clearOfflineScanQueue();
        console.log(`✅ Synced ${data.synced} offline scan logs`);
        return data.synced;
      }
    } catch (e) { console.warn("Failed to sync offline scan logs:", e.message); }
    return 0;
  }

  // ── Secure token generation ───────────────────────────────────────────────

  async generateSecureToken(studentId, timeWindow, secretKey) {
    if (!secretKey) throw new Error("Secret key required");
    const encoder = new TextEncoder();
    const data    = encoder.encode(`${studentId}|${timeWindow}`);
    try {
      const key = await crypto.subtle.importKey(
        "raw", encoder.encode(secretKey),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, data);
      return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      const fallback = `${studentId}|${timeWindow}|${secretKey}`;
      const buf      = await crypto.subtle.digest("SHA-256", encoder.encode(fallback));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 64);
    }
  }

  // ── Offline QR validation ─────────────────────────────────────────────────

  async validateQROffline(qrData) {
    try {
      const parts = qrData.trim().split("|");
      if (parts.length !== 3)
        return { success: true, valid: false, message: "Invalid QR format" };

      const [studentId, timeWindowStr, token] = parts;
      const timeWindow        = parseInt(timeWindowStr, 10);
      const currentTimeWindow = Math.floor(Date.now() / 60000);

      if (Math.abs(currentTimeWindow - timeWindow) > 1)
        return { success: true, valid: false, message: "QR code expired" };

      const studentData = await this.getStudentData(studentId);
      if (!studentData)
        return { success: true, valid: false, message: "Student not found in offline database" };

      if (studentData.status !== "active")
        return { success: true, valid: false, message: "Student account is not active" };

      if (!studentData.secretKey) {
        console.warn(`Missing secret key for ${studentId}`);
        return { success: false, valid: false, message: "Offline data incomplete (missing key)" };
      }

      const expectedToken = await this.generateSecureToken(studentId, timeWindow, studentData.secretKey);
      if (token.trim() !== expectedToken)
        return { success: true, valid: false, message: "Invalid QR token" };

      const cachedImage = await this.getStudentImage(studentId);

      return {
        success: true,
        valid:   true,
        student: {
          id:         studentData.studentId,
          name:       studentData.name,
          program:    studentData.program,
          department: studentData.department,
          year:       studentData.year,
          status:     studentData.status,
          imageLink:  cachedImage || studentData.imageLink || "",
        },
      };
    } catch (error) {
      console.error("Offline validation error:", error);
      return { success: false, valid: false, message: "Offline validation failed" };
    }
  }
}

export const offlineService = new OfflineService();
offlineService.initDB().catch(console.error);