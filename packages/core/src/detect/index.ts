/**
 * Internal detection subsystem. Not re-exported from the package entry point - `check` (M2)
 * and the CLI `scan` (M4) consume it; tests import from here directly.
 */

export { createDetectionEngine } from "./engine";
export type { DetectionEngine, DetectionEngineOptions } from "./engine";
export { builtinRecognizers } from "./recognizers";
export type { BuiltinRecognizerOptions } from "./recognizers";
export { mergeSpans } from "./merge";
export type { MergeOptions } from "./merge";
export { scanObject } from "./object-scan";
