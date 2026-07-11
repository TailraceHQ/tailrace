import type { EntityClass, Span } from "../../types";

/** A regex pattern paired with the confidence to emit for its matches. */
export interface Pattern {
  re: RegExp;
  confidence: number;
}

/**
 * Emit a span for every match of every pattern. Each `re` MUST carry the `g` flag.
 * `lastIndex` is reset before use, so module-level regexes are safe to reuse (the engine
 * is single-threaded and synchronous).
 */
export function scanPatterns(
  text: string,
  patterns: readonly Pattern[],
  entity: EntityClass,
  recognizer: string,
): Span[] {
  const spans: Span[] = [];
  for (const { re, confidence } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      spans.push({ entity, start: m.index, end: m.index + m[0].length, confidence, recognizer });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return spans;
}
