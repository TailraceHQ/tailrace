/**
 * @tailrace/recognizer-ner - optional Tier 1 NER recognizer (Node/Fluid only).
 *
 * Privacy Filter ONNX path (BIOES + constrained Viterbi). Lazy model load; fail-open to
 * Tier 0 if unavailable (docs/detection.md §3, prime directive #4). `core` must never
 * import this package.
 */

export type { NerRecognizerOptions } from "./recognizer";
export { nerRecognizer } from "./recognizer";
export type { NerRecommendedPolicyOptions } from "./policy";
export { nerRecommendedPolicy } from "./policy";
export {
  MODEL_LABEL_TO_ENTITY,
  NER_RECOGNIZER_ENTITIES,
  NER_RECOGNIZER_ID,
  PRIVACY_FILTER_ID2LABEL,
  mapModelLabelToEntity,
} from "./labels";
export { decodePrivacyFilterLogits } from "./decode";
export type { TokenizedText, TokenizerFn } from "./tokenize";
export { DEFAULT_HUB_REPO, DEFAULT_ONNX_FILE } from "./session";
