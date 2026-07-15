/**
 * Compile JSON-declared pattern recognizers for the CLI hot path.
 */

import { definePatternRecognizer, RecognizerError, type Recognizer } from "@tailrace/core";

export interface CompiledPatternRecognizer {
  id: string;
  entity: string;
  tier: 0;
  patterns: { source: string; confidence?: number }[];
}

export function isCompiledPatternRecognizer(value: unknown): value is CompiledPatternRecognizer {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.entity === "string" &&
    v.tier === 0 &&
    Array.isArray(v.patterns) &&
    v.patterns.every(
      (p) =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).source === "string",
    )
  );
}

/**
 * Turn compiled JSON recognizers into runtime {@link Recognizer} instances.
 * Throws {@link RecognizerError} on invalid patterns (fail fast at load).
 */
export function compileRecognizersFromConfig(
  entries: readonly CompiledPatternRecognizer[],
): Recognizer[] {
  return entries.map((entry, index) => {
    try {
      return definePatternRecognizer({
        id: entry.id,
        entity: entry.entity,
        tier: 0,
        patterns: entry.patterns,
      });
    } catch (err) {
      if (err instanceof RecognizerError) {
        throw new RecognizerError(`recognizers[${index}]: ${err.message.split(" → ")[0]}`);
      }
      throw err;
    }
  });
}
