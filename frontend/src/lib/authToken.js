/**
 * Pure auth-token helpers, framework-free so they're trivially unit-testable
 * (no axios import — CRA's Jest 27 can't transpile axios v1's ESM build).
 *
 * api.js wires these into the axios instance's interceptors.
 */
export const TOKEN_KEY = "jc_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Build the API base URL. When REACT_APP_BACKEND_URL is unset we degrade to a
 * same-origin "/api" path instead of the broken literal "undefined/api".
 */
export function resolveBaseURL(base) {
  const root = base && base !== "undefined" ? base.replace(/\/$/, "") : "";
  return `${root}/api`;
}

/** Request interceptor: attach the stored Bearer token, if any. */
export function attachAuthHeader(config) {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

/**
 * Response-error interceptor: on 401, drop the stale token so it stops being
 * resent. Only bounce to /login if we actually had a token (i.e. the user's
 * session expired); anonymous guests probing /auth/me must NOT be redirected.
 * Always re-rejects so callers still see the error.
 */
export function handleResponseError(error) {
  const status = error?.response?.status;
  if (status === 401) {
    const hadToken = !!getToken();
    clearToken();
    if (hadToken && typeof window !== "undefined") {
      const path = window.location?.pathname || "";
      if (!path.startsWith("/login")) {
        window.location.assign("/login?expired=1");
      }
    }
  }
  return Promise.reject(error);
}
