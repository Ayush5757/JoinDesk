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

export const adminApi = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(
      path,
      data !== undefined ? { method: "POST", body: JSON.stringify(data) } : { method: "POST" }
    ),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
