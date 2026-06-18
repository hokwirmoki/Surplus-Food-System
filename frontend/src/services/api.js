import axios from "axios";
import { clearSession, SESSION_EXPIRED_EVENT } from "../utils/session";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const API = axios.create({
  baseURL
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

      if (!["/", "/login"].includes(window.location.pathname)) {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);

export default API;
