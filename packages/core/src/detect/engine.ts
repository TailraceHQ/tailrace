/**
 * Detection engine: runs recognizers over a string or JSON object and returns merged spans.
 * Internal to core (not part of the public export surface) - consumed by `check` in M2 and by
 * the CLI `scan` command in M4.
 *
 * Tier 0 is synchronous end to end. A recognizer that returns a Promise (Tier 1) is rejected
 * here until async detection is wired in a later milestone.
 */

import { NotImplementedError } from "../errors";
import type { EntityClass, JsonObject, Recognizer, Span } from "../types";
import { mergeSpans } from "./merge";
import { scanObject } from "./object-scan";
import { builtinRecognizers } from "./recognizers";

export interface DetectionEngineOptions {
  /** Custom recognizers, appended after the builtins. */
  recognizers?: Recognizer[];
  /** Include the Tier 0 builtins. Default true. */
  useBuiltins?: boolean;
  /** Emit spans for private/reserved IP ranges. Default false. */
  includePrivateIps?: boolean;
  /** Per-entity confidence thresholds; entities not listed use `defaultThreshold`. */
  thresholds?: Partial<Record<EntityClass, number>>;
  /** Default minimum confidence (docs/detection.md §4). Default 0.6. */
  defaultThreshold?: number;
}

export interface DetectionEngine {
  readonly recognizers: readonly Recognizer[];
  /** Detect over a plain string or a JSON object; returns merged spans. */
  detect(input: string | JsonObject): Span[];
}

export function createDetectionEngine(opts: DetectionEngineOptions = {}): DetectionEngine {
  const recognizers: Recognizer[] = [
    ...(opts.useBuiltins === false
      ? []
      : builtinRecognizers({ includePrivateIps: opts.includePrivateIps ?? false })),
    ...(opts.recognizers ?? []),
  ];

  const mergeOpts = {
    ...(opts.thresholds !== undefined ? { thresholds: opts.thresholds } : {}),
    ...(opts.defaultThreshold !== undefined ? { defaultThreshold: opts.defaultThreshold } : {}),
  };

  const runRecognizers = (text: string): Span[] => {
    const spans: Span[] = [];
    for (const recognizer of recognizers) {
      const result = recognizer.scan(text);
      if (result instanceof Promise) {
        throw new NotImplementedError(
          "async (Tier 1) recognizers are wired in a later milestone; Tier 0 detection is synchronous",
        );
      }
      for (const span of result) spans.push(span);
    }
    return spans;
  };

  const scanLeaf = (text: string): Span[] => mergeSpans(runRecognizers(text), mergeOpts);

  const detect = (input: string | JsonObject): Span[] =>
    typeof input === "string" ? scanLeaf(input) : scanObject(input, scanLeaf);

  return { recognizers, detect };
}
