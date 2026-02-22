// src/config/api.js

// If we are in production, use the full URL. 
// If in dev, use empty string to let Vite Proxy handle it.
const API_BASE = import.meta.env.PROD 
  ? 'http://localhost:5000' 
  : ''; 

export default API_BASE;