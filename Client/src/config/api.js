// src/config/api.js

// In development: empty string so Vite's proxy handles requests (vite.config.js)
// In production:  reads VITE_API_BASE_URL from Vercel environment variables
const API_BASE = import.meta.env.PROD
  ? import.meta.env.VITE_API_BASE_URL
  : '';

export default API_BASE;