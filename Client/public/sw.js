// Client/public/sw.js
const CACHE_NAME = "nsems-v1";
const OFFLINE_URL = "/offline.html";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/src/App.css",
  "/src/main.jsx",
  "/src/App.jsx",
  "/offline.html",
  "/src/Login.jsx",
  "/src/StudentDashboard.jsx",
  "/src/AdminDashboard.jsx",
  "/src/services/qrService.js",
  "/src/services/syncService.js",
  "/src/services/scannerService.js",
  "/src/services/auth.js",
];

self.addEventListener("install", (event) => {
  console.log("NSEMS Service Worker: Installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Cache essential files for offline use
        return cache.addAll(["/", "/index.html", "/offline.html"]);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  console.log("NSEMS Service Worker: Activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(
                "NSEMS Service Worker: Deleting old cache:",
                cacheName,
              );
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// ✅ Handle messages from main thread
self.addEventListener("message", (event) => {
  if (event.data.action === "CACHE_PAGE") {
    cachePage(event.data.url);
  }

  if (event.data.action === "CACHE_ASSETS") {
    cacheAssets(event.data.assets);
  }
});

async function cachePage(url) {
  try {
    const response = await fetch(url);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, response.clone());
      console.log("✅ Page cached:", url);
    }
  } catch (error) {
    console.error("Failed to cache page:", error);
  }
}

async function cacheAssets(assets) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(assets);
    console.log("✅ Assets cached:", assets.length);
  } catch (error) {
    console.error("Failed to cache assets:", error);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip unsupported schemes
  if (!shouldHandleRequest(request)) {
    return;
  }

  // Handle navigation requests
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
  }
  // Handle API requests
  else if (request.url.includes("/api/")) {
    event.respondWith(handleApiRequest(request));
  }
  // Handle static assets
  else {
    event.respondWith(handleStaticRequest(request));
  }
});

function shouldHandleRequest(request) {
  const url = new URL(request.url);
  return ["http:", "https:"].includes(url.protocol);
}

async function handleNavigationRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to offline page
    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }

    // Last resort
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>NSEMS - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #f0f9f1, #e6f7ee); }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            h1 { color: #1a2e2a; margin-bottom: 20px; }
            .status { background: #f8fbf9; padding: 15px; border-radius: 10px; margin: 20px 0; }
            .status-indicator { display: inline-flex; align-items: center; gap: 10px; background: #e6f7ee; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
            .dot { width: 12px; height: 12px; background: #22c55e; border-radius: 50%; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Offline Mode Active</h1>
            <p>Your NSEMS application is running in offline mode. All core features are available without internet connection.</p>
            <div class="status">
              <div class="status-indicator">
                <div class="dot"></div>
                <span>Working Offline</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  }
}

// Rest of your existing functions remain the same...
async function handleStaticRequest(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return (
      cachedResponse || new Response("Resource unavailable", { status: 404 })
    );
  }
}

async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Login requests
  if (url.pathname === "/api/auth/login") {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const data = await networkResponse.clone().json();
        // Store login data in IndexedDB (you'll need to implement this)
        await storeLoginData(data);
      }
      return networkResponse;
    } catch (error) {
      // Try to get cached login data
      const cachedData = await getLoginData();
      if (cachedData) {
        return new Response(JSON.stringify(cachedData), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }
  }

  // QR validation
  if (url.pathname === "/api/scanner/validate") {
    try {
      return await fetch(request);
    } catch (error) {
      // Try offline validation
      const offlineResult = await validateQROffline(request);
      if (offlineResult) {
        return new Response(JSON.stringify(offlineResult), {
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }
  }

  // Other API requests
  try {
    return await fetch(request);
  } catch (error) {
    throw error;
  }
}

// IndexedDB operations (keep your existing implementation)
async function storeLoginData(data) {
  try {
    const db = await openDB();
    const tx = db.transaction("loginData", "readwrite");
    const store = tx.objectStore("loginData");
    await store.put(data, "currentLogin");
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch (error) {
    console.error("Failed to store login ", error);
  }
}

async function getLoginData() {
  try {
    const db = await openDB();
    const tx = db.transaction("loginData", "readonly");
    const store = tx.objectStore("loginData");
    const data = await store.get("currentLogin");
    return data;
  } catch (error) {
    console.error("Failed to get login ", error);
    return null;
  }
}

async function validateQROffline(request) {
  try {
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    const { qrData } = body;

    // Parse QR data
    const parts = qrData.trim().split("|");
    if (parts.length !== 3) {
      return { success: false, valid: false, message: "Invalid QR format" };
    }

    const [studentId, timeWindowStr, token] = parts;
    const timeWindow = parseInt(timeWindowStr, 10);
    const currentTimeWindow = Math.floor(Date.now() / 60000);

    // Validate time window
    if (Math.abs(currentTimeWindow - timeWindow) > 1) {
      return { success: true, valid: false, message: "QR code expired" };
    }

    // Get student data from IndexedDB
    const studentData = await getStudentData(studentId);
    if (!studentData) {
      return {
        success: true,
        valid: false,
        message: "Student not found in offline database",
      };
    }

    // Check student status
    if (studentData.status !== "active") {
      return {
        success: true,
        valid: false,
        message: "Student account is not active",
      };
    }

    // Verify token using stored secret key
    const expectedToken = await generateSecureToken(
      studentId,
      timeWindow,
      studentData.secretKey,
    );
    if (token !== expectedToken) {
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

async function getStudentData(studentId) {
  try {
    const db = await openDB();
    const tx = db.transaction("students", "readonly");
    const store = tx.objectStore("students");
    const student = await store.get(studentId);
    return student;
  } catch (error) {
    console.error("Failed to get student data:", error);
    return null;
  }
}

async function generateSecureToken(studentId, timeWindow, secretKey) {
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
    console.error("Crypto error in SW:", error);
    // Fallback
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

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("NSEMS_DB", 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("loginData")) {
        db.createObjectStore("loginData");
      }
      if (!db.objectStoreNames.contains("students")) {
        const studentsStore = db.createObjectStore("students", {
          keyPath: "studentId",
        });
        studentsStore.createIndex("secretKey", "secretKey", { unique: false });
      }
    };
  });
}
