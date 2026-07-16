/**
 * Normalize unknown values for check / restore original shape.
 */

import type { JsonObject, JsonValue } from "@tailrace/core";

/**
 * Coerce an unknown value into a shape `tailrace.check` accepts.
 *
 * @example
 * ```ts
 * asCheckable({ email: "a@example.com" }); // object as-is
 * asCheckable("hello"); // string as-is
 * asCheckable(42); // { value: 42 }
 * ```
 */
export function asCheckable(value: unknown): string | JsonObject {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  // Arrays / primitives: wrap so object-scan can walk string leaves.
  // Deferred: wrapping as `{ value }` can collide with a tool that natively
  // returns `{ value: ... }` when unwrapping - see OPEN_QUESTIONS.md.
  return { value: value as JsonValue };
}

/**
 * Restore the original value shape after a check rewrite.
 */
export function unwrapCheckable(original: unknown, checked: string | JsonObject): unknown {
  if (typeof original === "string") return checked;
  if (original === null || original === undefined) return original;
  if (typeof original === "object" && !Array.isArray(original)) return checked;
  if (
    typeof checked === "object" &&
    checked !== null &&
    "value" in checked &&
    (Array.isArray(original) || typeof original === "number" || typeof original === "boolean")
  ) {
    return (checked as JsonObject)["value"];
  }
  return checked;
}
