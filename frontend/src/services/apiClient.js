import axios from "axios";
import { store } from "../app/store";
import { logoutSuccess } from "../features/auth/authSlice";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // Required for HTTP-only cookies
  headers: {
    "Content-Type": "application/json",
  },
});

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
let csrfToken = null;
let csrfTokenPromise = null;
let refreshPromise = null;

const ensureCsrfToken = () => {
  if (csrfToken) return Promise.resolve(csrfToken);

  if (!csrfTokenPromise) {
    csrfTokenPromise = axios
      .get(`${apiBaseUrl}/auth/csrf-token`, { withCredentials: true })
      .then((response) => {
        csrfToken = response.data?.data?.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }

  return csrfTokenPromise;
};

const shouldSkipRefresh = (url = "") => [
  "/auth/login",
  "/auth/register",
  "/auth/google",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
].some((path) => url.includes(path));

const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh", {}, { skipAuthRefresh: true })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
  const isCsrfEndpoint = config.url?.includes("/auth/csrf-token");

  if (!isSafeMethod && !isCsrfEndpoint && !config.skipCsrf) {
    const token = await ensureCsrfToken();
    if (token) {
      config.headers["X-CSRF-Token"] = token;
    }
  }

  return config;
});

// Response interceptor refreshes an expired access-token cookie once, then
// retries the original request. The refresh token never enters JavaScript.
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const canRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !shouldSkipRefresh(originalRequest.url);

    if (canRefresh) {
      originalRequest._retry = true;

      try {
        await refreshSession();
        return apiClient(originalRequest);
      } catch {
        store.dispatch(logoutSuccess());
      }
    }

    const message =
      error.response?.data?.message || "An unexpected error occurred.";
    return Promise.reject({
      message,
      statusCode: error.response?.status,
      data: error.response?.data,
      response: error.response,
    });
  }
);

export default apiClient;
