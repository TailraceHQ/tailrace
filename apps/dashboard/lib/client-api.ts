"use client";

const STORAGE_KEY = "tailrace_plane_api_key";

export function getStoredApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = getStoredApiKey();
  const headers = new Headers(init?.headers);
  if (key !== null) {
    headers.set("Authorization", `Bearer ${key}`);
  }
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}
