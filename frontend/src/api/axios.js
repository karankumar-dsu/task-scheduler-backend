import axios from "axios";

// Reads VITE_API_URL from .env (dev) / .env.production (build) so this can
// point at localhost, Railway, or wherever, without editing this file.
// Falls back to localhost only if no env value was provided.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { API_BASE };