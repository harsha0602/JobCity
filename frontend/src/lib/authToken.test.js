/**
 * Unit tests for the auth-token / interceptor logic (P0/P1 frontend findings).
 *
 * These cover the exact functions api.js wires into axios, without importing
 * axios (CRA's Jest 27 can't transpile axios v1's ESM build).
 */
import {
  TOKEN_KEY,
  attachAuthHeader,
  handleResponseError,
  resolveBaseURL,
} from "@/lib/authToken";

beforeEach(() => {
  localStorage.clear();
});

describe("resolveBaseURL", () => {
  test("degrades to same-origin /api when backend URL is unset", () => {
    expect(resolveBaseURL(undefined)).toBe("/api");
    expect(resolveBaseURL("")).toBe("/api");
    // Guards against the classic "undefined/api" stringification bug.
    expect(resolveBaseURL("undefined")).toBe("/api");
  });

  test("uses the configured backend URL and strips a trailing slash", () => {
    expect(resolveBaseURL("https://api.example.com")).toBe("https://api.example.com/api");
    expect(resolveBaseURL("https://api.example.com/")).toBe("https://api.example.com/api");
  });
});

describe("attachAuthHeader", () => {
  test("attaches the Bearer token when present", () => {
    localStorage.setItem(TOKEN_KEY, "tok123");
    const config = attachAuthHeader({});
    expect(config.headers.Authorization).toBe("Bearer tok123");
  });

  test("leaves config untouched when no token", () => {
    const config = attachAuthHeader({ headers: { X: "1" } });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("handleResponseError", () => {
  test("clears the stale token on 401", async () => {
    localStorage.setItem(TOKEN_KEY, "expired");
    const err = { response: { status: 401 } };
    await expect(handleResponseError(err)).rejects.toBe(err);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("leaves the token intact on non-401 errors", async () => {
    localStorage.setItem(TOKEN_KEY, "good");
    const err = { response: { status: 500 } };
    await expect(handleResponseError(err)).rejects.toBe(err);
    expect(localStorage.getItem(TOKEN_KEY)).toBe("good");
  });

  test("re-rejects so callers still see the error", async () => {
    const err = new Error("network");
    await expect(handleResponseError(err)).rejects.toBe(err);
  });
});
