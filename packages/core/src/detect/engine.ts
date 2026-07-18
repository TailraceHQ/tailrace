/**
 * Detection engine: runs recognizers over a string or JSON object and returns merged spans.
 * Internal to core (not part of the public export surface) - consumed by `check` and by
 * the CLI `scan` command.
 *
 * Tier 0 recognizers are synchronous. Tier 1 may return a Promise; the engine awaits them.
 * A throwing / rejected recognizer is skipped after one warning (fail open).
 */

import { getConsole } from "../console";
import { RecognizerError, TailraceError } from "../errors";
import type { EntityClass, JsonObject, Recognizer, Span } from "../types";
import { mergeSpans } from "./merge";
import { scanObjectAsync } from "./object-scan";
import { builtinRecognizers } from "./recognizers";

const DEFAULT_MAX_CUSTOM_RECOGNIZERS = 16;

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
  /** Max custom recognizers allowed. Default 16. */
  maxCustomRecognizers?: number;
}

export interface DetectionEngine {
  readonly recognizers: readonly Recognizer[];
  /** Detect over a plain string or a JSON object; returns merged spans. */
  detect(input: string | JsonObject): Promise<Span[]>;
}

function assertRecognizerLimits(custom: Recognizer[], maxCustom: number): void {
  if (custom.length > maxCustom) {
    throw new RecognizerError(`too many custom recognizers (${custom.length} > ${maxCustom})`);
  }
}

function assertUniqueRecognizerIds(recognizers: Recognizer[]): void {
  const ids = new Set<string>();
  for (const recognizer of recognizers) {
    if (ids.has(recognizer.id)) {
      throw new RecognizerError(`duplicate recognizer id "${recognizer.id}"`);
    }
    ids.add(recognizer.id);
  }
}

export function createDetectionEngine(opts: DetectionEngineOptions = {}): DetectionEngine {
  const custom = opts.recognizers ?? [];
  const maxCustom = opts.maxCustomRecognizers ?? DEFAULT_MAX_CUSTOM_RECOGNIZERS;
  assertRecognizerLimits(custom, maxCustom);

  const recognizers: Recognizer[] = [
    ...(opts.useBuiltins === false
      ? []
      : builtinRecognizers({ includePrivateIps: opts.includePrivateIps ?? false })),
    ...custom,
  ];

  assertUniqueRecognizerIds(recognizers);

  const mergeOpts = {
    ...(opts.thresholds !== undefined ? { thresholds: opts.thresholds } : {}),
    ...(opts.defaultThreshold !== undefined ? { defaultThreshold: opts.defaultThreshold } : {}),
  };

  const warnedRecognizerFailures = new Set<string>();

  const warnRecognizerFailure = (recognizerId: string, err: unknown): void => {
    if (warnedRecognizerFailures.has(recognizerId)) return;
    warnedRecognizerFailures.add(recognizerId);
    const reason =
      err instanceof TailraceError ? err.message.split(" → ")[0] : "recognizer threw during scan";
    getConsole()?.warn(`[tailrace] recognizer "${recognizerId}" failed (skipped): ${reason}`);
  };

  const runRecognizers = async (text: string): Promise<Span[]> => {
    const spans: Span[] = [];
    for (const recognizer of recognizers) {
      try {
        const result = recognizer.scan(text);
        // Tier 0 recognizers return an array synchronously; only await Tier 1's Promise
        // so sync-only configurations pay no microtask overhead on the hot path.
        const resolved = result instanceof Promise ? await result : result;
        for (const span of resolved) spans.push(span);
      } catch (err) {
        warnRecognizerFailure(recognizer.id, err);
      }
    }
    return spans;
  };

  const scanLeaf = async (text: string): Promise<Span[]> =>
    mergeSpans(await runRecognizers(text), mergeOpts);

  const detect = async (input: string | JsonObject): Promise<Span[]> =>
    typeof input === "string" ? scanLeaf(input) : scanObjectAsync(input, scanLeaf);

  return { recognizers, detect };
}
