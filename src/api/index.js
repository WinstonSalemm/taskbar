import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Интерцептор для добавления токена
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth-storage");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  logout: () => api.post("/auth/logout"),
};

export const firmsAPI = {
  getAll: () => api.get("/firms"),
  getById: (id) => api.get(`/firms/${id}`),
  getEmployees: (firmId) => api.get(`/firms/${firmId}/employees`),
};

export const tasksAPI = {
  getByFirm: (firmId) => {
    console.log("📡 [API] Getting tasks for firm:", firmId);
    return api.get(`/tasks/firm/${firmId}`);
  },
  getByEmployee: (employeeId) => {
    console.log("📡 [API] Getting tasks for employee:", employeeId);
    return api.get(`/tasks/employee/${employeeId}`);
  },
  getById: (id) => api.get(`/tasks/${id}`),
  create: (data) => {
    console.log("📡 [API] Creating task:", data);
    return api.post("/tasks", data);
  },
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
  addComment: (id, comment) => api.post(`/tasks/${id}/comments`, comment),
};

export const filesAPI = {
  upload: (formData, taskId) =>
    api.post(`/tasks/${taskId}/files`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getByTask: (taskId) => api.get(`/tasks/${taskId}/files`),
  delete: (taskId, fileId) => api.delete(`/tasks/${taskId}/files/${fileId}`),
  download: (fileId) =>
    api.get(`/files/${fileId}/download`, {
      responseType: "blob",
    }),
};

export default api;
