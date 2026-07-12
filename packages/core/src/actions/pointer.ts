/**
 * RFC 6901 JSON Pointer get/set for string leaves, used when applying actions to objects.
 */

import type { JsonObject, JsonValue } from "../types";

function unescapePointer(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Deep-clone a JSON-compatible value (structuredClone when available). */
export function cloneJson<T extends JsonValue>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Read a string at an RFC 6901 pointer. Returns null if the path is missing or
 * does not point at a string.
 */
export function getStringAtPointer(root: JsonObject, pointer: string): string | null {
  if (pointer === "" || pointer === "/") {
    return null;
  }
  const parts = pointer.startsWith("/") ? pointer.slice(1).split("/") : pointer.split("/");
  let cur: JsonValue = root;
  for (const raw of parts) {
    const key = unescapePointer(raw);
    if (cur === null || typeof cur !== "object") return null;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return null;
      cur = cur[idx]!;
    } else {
      if (!(key in cur)) return null;
      cur = (cur as JsonObject)[key]!;
    }
  }
  return typeof cur === "string" ? cur : null;
}

/**
 * Replace the string at an RFC 6901 pointer. Mutates `root` in place.
 * No-op if the path does not point at a string.
 */
export function setStringAtPointer(root: JsonObject, pointer: string, value: string): void {
  if (pointer === "" || pointer === "/") return;
  const parts = pointer.startsWith("/") ? pointer.slice(1).split("/") : pointer.split("/");
  let cur: JsonValue = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = unescapePointer(parts[i]!);
    if (cur === null || typeof cur !== "object") return;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = cur[idx]!;
    } else {
      cur = (cur as JsonObject)[key]!;
    }
  }
  const last = unescapePointer(parts[parts.length - 1]!);
  if (cur === null || typeof cur !== "object") return;
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (Number.isInteger(idx) && idx >= 0 && idx < cur.length && typeof cur[idx] === "string") {
      cur[idx] = value;
    }
  } else if (typeof (cur as JsonObject)[last] === "string") {
    (cur as JsonObject)[last] = value;
  }
}
