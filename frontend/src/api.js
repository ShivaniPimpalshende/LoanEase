import axios from "axios";

const BASE = "http://localhost:8000";

const http = axios.create({ baseURL: BASE });

export const api = {
  requestOtp:    (data)          => http.post("/auth/request-otp", data),
  verifyOtp:     (data)          => http.post("/auth/verify-otp", data),
  // Applications CRUD
  submitApp:     (data)          => http.post("/applications/",           data),
  listApps:      (params = {})   => http.get("/applications/",            { params }),
  getApp:        (id)            => http.get(`/applications/${id}`),
  getHistory:    (id)            => http.get(`/applications/${id}/history`),
  overrideApp:   (id, rec)       => http.put(`/applications/${id}/override`, { recommendation: rec }),
  whatIf:        (id, data)      => http.post(`/applications/${id}/what-if`, data),
  chat:          (id, data)      => http.post(`/applications/${id}/chat`, data),
  applyTerms:    (id, data)      => http.put(`/applications/${id}/terms`, data),

  // Stats + metadata
  getStats:      ()              => http.get("/applications/meta/stats"),
  getLoanProducts: ()            => http.get("/applications/meta/loan-products"),

  // Notify (F5)
  notifyApp:     (id, message)   => http.post(`/applications/${id}/notify`, message ? { custom_message: message } : undefined),
  getNotifications: ()          => http.get("/applications/meta/notifications"),
};
