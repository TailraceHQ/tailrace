import type { EntityClass, Span } from "../../types";

/** A regex pattern paired with the confidence to emit for its matches. */
export interface Pattern {
  re: RegExp;
  confidence: number;
}

export interface ScanPatternsLimits {
  /** Max matches per pattern per leaf. Default: unlimited. */
  maxMatchesPerPattern?: number;
  /** Wall-clock budget in ms for this recognizer on one leaf. Default: unlimited. */
  budgetMs?: number;
  /** Called once when the budget is exceeded (caller may dedupe). */
  onBudgetExceeded?: () => void;
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
  limits?: ScanPatternsLimits,
): Span[] {
  const maxMatches = limits?.maxMatchesPerPattern ?? Number.POSITIVE_INFINITY;
  const budgetMs = limits?.budgetMs ?? Number.POSITIVE_INFINITY;
  const started = performance.now();

  const spans: Span[] = [];
  for (const { re, confidence } of patterns) {
    re.lastIndex = 0;
    let matchCount = 0;
    let iterations = 0;
    const maxIterations = text.length + 1;
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
      if (++iterations > maxIterations) break;

      if (performance.now() - started > budgetMs) {
        limits?.onBudgetExceeded?.();
        return spans;
      }

      spans.push({ entity, start: m.index, end: m.index + m[0].length, confidence, recognizer });
      matchCount++;
      if (matchCount >= maxMatches) {
        limits?.onBudgetExceeded?.();
        return spans;
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return spans;
}
