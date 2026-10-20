// The ONE place where the React app talks to the Express API.
//
// - Sends cookies (credentials: "include") so the HttpOnly login cookie is used.
// - Adds the X-Requested-With header the server requires for CSRF protection.
// - Turns every failure into an ApiError with a readable message.
// - Never fakes a success and never falls back to localStorage.

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let unauthorizedHandler = null;
// AuthContext registers a callback here so an expired session logs the user out.
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

async function request(method, path, body) {
  const headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE_URL}/api${path}`, {
      method,
      credentials: "include",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please check your connection and try again.", 0, "NETWORK_ERROR");
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page)
  }

  if (!res.ok) {
    const err = new ApiError(
      payload?.error?.message || `Request failed (HTTP ${res.status}). Please try again.`,
      res.status,
      payload?.error?.code,
      payload?.error?.details,
    );
    if (res.status === 401 && unauthorizedHandler && !path.startsWith("/auth/login")) {
      unauthorizedHandler(err);
    }
    throw err;
  }
  return payload ?? { data: null };
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  patch: (path, body = {}) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};
