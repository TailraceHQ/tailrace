/**
 * Span merging (docs/detection.md §4). Operates on spans from a single coordinate space
 * (one string / one object leaf): the engine merges each leaf's spans before attaching a path.
 */

import type { EntityClass, Span } from "../types";

export interface MergeOptions {
  /** Per-entity minimum confidence. Entities not listed use `defaultThreshold`. */
  thresholds?: Partial<Record<EntityClass, number>>;
  /** Default minimum confidence (docs/detection.md §4). */
  defaultThreshold?: number;
}

const DEFAULT_THRESHOLD = 0.6;

/**
 * 1. Drop spans below their per-entity confidence threshold.
 * 2. Union overlapping spans of the same entity.
 * 3. Keep overlapping spans of different entities (policy applies most-restrictive later).
 * 4. Return sorted by `start` ascending (rewriting applies right-to-left).
 */
export function mergeSpans(spans: readonly Span[], opts: MergeOptions = {}): Span[] {
  const defaultThreshold = opts.defaultThreshold ?? DEFAULT_THRESHOLD;
  const thresholds = opts.thresholds ?? {};
  const thresholdFor = (entity: EntityClass): number => thresholds[entity] ?? defaultThreshold;

  const byEntity = new Map<EntityClass, Span[]>();
  for (const span of spans) {
    if (span.confidence < thresholdFor(span.entity)) continue;
    const group = byEntity.get(span.entity);
    if (group) group.push(span);
    else byEntity.set(span.entity, [span]);
  }

  const out: Span[] = [];
  for (const group of byEntity.values()) {
    group.sort((a, b) => a.start - b.start || a.end - b.end);
    let current = group[0]!;
    for (let i = 1; i < group.length; i++) {
      const span = group[i]!;
      if (span.start < current.end) {
        // Overlap, same entity -> union (widen span, keep the higher confidence).
        current = {
          ...current,
          end: Math.max(current.end, span.end),
          confidence: Math.max(current.confidence, span.confidence),
        };
      } else {
        out.push(current);
        current = span;
      }
    }
    out.push(current);
  }

  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}
