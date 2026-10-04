import { ADMIN_TOKEN_KEY } from "./adminAuth";
import { ApiError } from "./api";

const API_URL = (import.meta.env["VITE_API_URL"] as string) || "http://localhost:5000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);

  const init: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  const res = await fetch(`${API_URL}${path}`, init);

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed with status ${res.status}`, res.status);
  }

  return body as T;
}

// For file downloads (Excel exports): same auth, but returns the raw file.
async function requestBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status);
  }
  return res.blob();
}

export const adminApi = {
  getBlob: (path: string) => requestBlob(path),
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(
      path,
      data !== undefined ? { method: "POST", body: JSON.stringify(data) } : { method: "POST" },
    ),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
