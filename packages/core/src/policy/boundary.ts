/**
 * Boundary key encoding and glob matching for policy resolution.
 *
 * // SPEC-QUESTION: Boundary key encoding - docs/policy-engine.md shows examples like
 * // `mcp:salesforce/*` and `openai/*` but does not define the full encoding for tool /
 * // mcp / egress keys. Locked for v0.1: model → provider; tool → `tool:{name}:{direction}`;
 * // mcp → `mcp:{server}/{tool}`; telemetry → `telemetry`; egress → `egress:{sink}`.
 */

import type { Boundary } from "../types";

/** Encode a {@link Boundary} as the string key used in policy `boundaries` maps. */
export function boundaryKey(boundary: Boundary): string {
  switch (boundary.kind) {
    case "model":
      return boundary.provider;
    case "tool":
      return `tool:${boundary.name}:${boundary.direction}`;
    case "mcp":
      return `mcp:${boundary.server}/${boundary.tool}`;
    case "telemetry":
      return "telemetry";
    case "egress":
      return `egress:${boundary.sink}`;
  }
}

/** True when a boundary pattern / key refers to an egress sink. */
export function isEgressBoundaryKey(key: string): boolean {
  return key === "egress" || key.startsWith("egress:");
}

/**
 * Glob match where `*` matches any remainder (including empty and `/`-containing).
 * Exact strings (no `*`) match only themselves.
 */
export function globMatch(pattern: string, key: string): boolean {
  if (!pattern.includes("*")) return pattern === key;
  const parts = pattern.split("*");
  if (parts.length === 1) return pattern === key;

  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (part.length === 0) {
      if (i === 0) continue;
      if (i === parts.length - 1) return true;
      continue;
    }
    if (i === 0) {
      if (!key.startsWith(part)) return false;
      pos = part.length;
      continue;
    }
    if (i === parts.length - 1) {
      return key.endsWith(part) && key.length - part.length >= pos;
    }
    const idx = key.indexOf(part, pos);
    if (idx === -1) return false;
    pos = idx + part.length;
  }
  return true;
}

/**
 * Return patterns that match `key`, ordered most-specific first:
 * exact > longer glob > shorter glob.
 */
export function matchBoundaryPatterns(key: string, patterns: readonly string[]): string[] {
  const matched = patterns.filter((p) => globMatch(p, key));
  matched.sort((a, b) => {
    const aGlob = a.includes("*") ? 1 : 0;
    const bGlob = b.includes("*") ? 1 : 0;
    if (aGlob !== bGlob) return aGlob - bGlob;
    return b.length - a.length;
  });
  return matched;
}
