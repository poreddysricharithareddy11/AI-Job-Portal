import axios from "axios";

// Fallback URL (safety for production)
const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "https://ai-job-portal-backend-0acj.onrender.com";

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
