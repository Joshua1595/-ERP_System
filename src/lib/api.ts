import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach JWT Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("erp_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor to handle token rotation (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Guard to prevent infinite refresh loops or refresh failures
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes("/auth/refresh") && !originalRequest.url.includes("/auth/login")) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("erp_refresh_token");
      if (!refreshToken) {
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post("/api/auth/refresh", { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem("erp_access_token", accessToken);
        localStorage.setItem("erp_refresh_token", newRefreshToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        clearSessionAndRedirect();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function clearSessionAndRedirect() {
  localStorage.removeItem("erp_access_token");
  localStorage.removeItem("erp_refresh_token");
  localStorage.removeItem("erp_user");
  // Only reload if not already at login
  if (!window.location.pathname.includes("/login")) {
    window.location.href = "/login";
  }
}
