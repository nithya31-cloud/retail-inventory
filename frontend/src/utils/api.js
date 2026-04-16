/**
 * utils/api.js
 * Centralised Axios instance with JWT interceptors.
 */
import axios from "axios";

const api = axios.create({
  baseURL:  import.meta.env.VITE_API_URL || "http://localhost:4000/api",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally → redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login:   (data)     => api.post("/auth/login", data),
  profile: ()         => api.get("/auth/profile"),
  changePassword: (d) => api.put("/auth/change-password", d),
};

// ── Products ─────────────────────────────────────────────────
export const productsApi = {
  getAll:   (params) => api.get("/products", { params }),
  getById:  (id)     => api.get(`/products/${id}`),
  create:   (data)   => api.post("/products", data),
  update:   (id, d)  => api.put(`/products/${id}`, d),
  remove:   (id)     => api.delete(`/products/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────
export const analyticsApi = {
  kpis:             ()       => api.get("/analytics/kpis"),
  abc:              ()       => api.get("/analytics/abc"),
  trends:           (period) => api.get("/analytics/trends", { params: { period } }),
  dos:              ()       => api.get("/analytics/dos"),
  forecasts:        ()       => api.get("/analytics/forecasts"),
  recommendations:  ()       => api.get("/analytics/recommendations"),
  categoryDist:     ()       => api.get("/analytics/category-distribution"),
  stockClass:       ()       => api.get("/analytics/stock-classification"),
  refresh:          ()       => api.post("/analytics/refresh"),
};

// ── Alerts ────────────────────────────────────────────────────
export const alertsApi = {
  getAll:    (params) => api.get("/alerts", { params }),
  getSummary: ()      => api.get("/alerts/summary"),
  markRead:  (id)     => api.put(`/alerts/${id}/read`),
  generate:  ()       => api.post("/alerts/generate"),
};

// ── Categories & Suppliers ────────────────────────────────────
export const metaApi = {
  categories: () => api.get("/categories"),
  suppliers:  () => api.get("/suppliers"),
};

// ── Export ────────────────────────────────────────────────────
export const exportApi = {
  productsCsv: () => `${api.defaults.baseURL}/export/products/csv`,
  salesCsv:    (from, to) =>
    `${api.defaults.baseURL}/export/sales/csv?from=${from}&to=${to}`,
  reportPdf:   () => `${api.defaults.baseURL}/export/report/pdf`,
};

// ── Upload ────────────────────────────────────────────────────
export const uploadApi = {
  dataset: (file, type) => {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    return api.post("/upload/dataset", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// ── Formatting helpers ────────────────────────────────────────
export const fmt = {
  inr:     (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
  inrFull: (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
  pct:     (n) => `${Number(n || 0).toFixed(1)}%`,
  num:     (n) => Number(n || 0).toLocaleString("en-IN"),
  date:    (d) => new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }),
};

export default api;
