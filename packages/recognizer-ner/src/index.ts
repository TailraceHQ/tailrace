/**
 * @tailrace/recognizer-ner - optional Tier 1 NER recognizer (Node/Fluid only).
 *
 * Wraps a quantized GLiNER-class ONNX model to emit `person`, `location`, and `organization`
 * spans. Lazy model load on first scan; if the model is unavailable at runtime it logs one
 * warning and disables itself, never crashing the host (docs/detection.md §3, prime directive
 * #4). `core` must never import this package. M0 skeleton: body lands with Tier 1.
 */

import { NotImplementedError, type Recognizer } from "@tailrace/core";

export interface NerRecognizerOptions {
  /** Local path to the ONNX model; overrides the pinned HF-hub download. */
  modelPath?: string;
  /** HF-hub revision to pin when downloading. */
  revision?: string;
  /** Local cache directory for the downloaded model. */
  cacheDir?: string;
}

// Deferred: pick the specific GLiNER-class model (best F1-per-MB) post-v0.1 and
// record candidates + benchmarks in OPEN_QUESTIONS.md (docs/detection.md §3).

/**
 * Build the Tier 1 NER recognizer to pass into `createTailrace({ recognizers: [...] })`.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ recognizers: [nerRecognizer()] });
 * ```
 */
export function nerRecognizer(opts?: NerRecognizerOptions): Recognizer {
  throw new NotImplementedError(
    "@tailrace/recognizer-ner lands after core Tier 0 detection (docs/detection.md §3)",
  );
}
