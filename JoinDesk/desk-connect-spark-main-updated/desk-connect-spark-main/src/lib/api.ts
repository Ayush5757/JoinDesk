// Key our own backend-issued session token is stored under. Both this
// file and lib/auth.ts read/write this same localStorage key.
export const AUTH_TOKEN_KEY = "auth_token";

const API_URL = (import.meta.env["VITE_API_URL"] as string) || "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

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

// Like `request`, but for multipart bodies (e.g. avatar upload) — never sets
// Content-Type manually so the browser can add the correct multipart
// boundary itself.
async function requestForm<T>(path: string, method: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed with status ${res.status}`, res.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, data !== undefined ? { method: "POST", body: JSON.stringify(data) } : { method: "POST" }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData) => requestForm<T>(path, "POST", formData),
  patchForm: <T>(path: string, formData: FormData) => requestForm<T>(path, "PATCH", formData),
};
