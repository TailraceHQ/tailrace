/**
 * Object scanning (docs/detection.md §5). Walks the string leaves of a JSON object, scans
 * each with `scanLeaf`, and tags the resulting spans with an RFC 6901 JSON Pointer. Keys are
 * scanned too (a secret can be a key). Non-string leaves are ignored. Depth-limited and
 * cycle-safe.
 */

import type { JsonObject, JsonValue, Span } from "../types";

const DEFAULT_MAX_DEPTH = 32;

/** Escape a property name for use in an RFC 6901 JSON Pointer. */
function escapePointer(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * @param scanLeaf scans a single string and returns spans with offsets relative to that
 *   string (no `path`); this function attaches the path.
 */
export function scanObject(
  input: JsonObject,
  scanLeaf: (text: string) => Span[],
  maxDepth: number = DEFAULT_MAX_DEPTH,
): Span[] {
  const out: Span[] = [];
  const seen = new WeakSet<object>();

  const walk = (value: JsonValue, path: string, depth: number): void => {
    if (typeof value === "string") {
      for (const span of scanLeaf(value)) out.push({ ...span, path });
      return;
    }
    if (value === null || typeof value !== "object") return; // numbers, booleans ignored
    if (seen.has(value)) return; // cycle guard
    if (depth >= maxDepth) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        walk(value[i]!, `${path}/${i}`, depth + 1);
      }
    } else {
      for (const [key, child] of Object.entries(value)) {
        const childPath = `${path}/${escapePointer(key)}`;
        for (const span of scanLeaf(key)) out.push({ ...span, path: childPath });
        walk(child, childPath, depth + 1);
      }
    }
  };

  walk(input, "", 0);
  return out;
}
