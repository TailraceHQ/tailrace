/**
 * Extract / rewrite tools/call arguments and MCP result payloads for check().
 */

import type { JsonObject, JsonValue } from "@tailrace/core";

/** Wrap opaque values so object-scan can walk string leaves. */
export function asCheckable(value: unknown): string | JsonObject {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return { value: value as JsonValue };
}

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

export function getToolsCallName(params: unknown): string | undefined {
  if (typeof params !== "object" || params === null) return undefined;
  const name = (params as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

export function getToolsCallArguments(params: unknown): unknown {
  if (typeof params !== "object" || params === null) return {};
  const args = (params as { arguments?: unknown }).arguments;
  return args === undefined ? {} : args;
}

/**
 * Rewrite `params.arguments` after a successful check. Returns a shallow-cloned params object.
 */
export function withRewrittenArguments(params: unknown, checkedArgs: unknown): unknown {
  if (typeof params !== "object" || params === null) {
    return { arguments: checkedArgs };
  }
  return { ...(params as Record<string, unknown>), arguments: checkedArgs };
}
