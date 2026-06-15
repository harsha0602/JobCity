import axios from "axios";
import {
  resolveBaseURL,
  attachAuthHeader,
  handleResponseError,
} from "@/lib/authToken";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: resolveBaseURL(BASE),
  withCredentials: false,
  timeout: 30000,
});

// Attach Bearer token from localStorage (belt + suspenders).
api.interceptors.request.use(attachAuthHeader);

// On 401, clear the stale token and redirect to /login instead of resending it.
api.interceptors.response.use((r) => r, handleResponseError);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const BACKEND_URL = BASE;
