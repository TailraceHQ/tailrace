import type { Recognizer } from "../../types";
import { ipAddressRecognizer, STATIC_PII_RECOGNIZERS } from "./pii";
import { SECRET_RECOGNIZERS } from "./secrets";

export interface BuiltinRecognizerOptions {
  /** Emit spans for private/reserved IP ranges (docs/detection.md §2). Default false. */
  includePrivateIps?: boolean;
}

/** The full set of Tier 0 recognizers that ship in core. */
export function builtinRecognizers(opts: BuiltinRecognizerOptions = {}): Recognizer[] {
  return [
    ...SECRET_RECOGNIZERS,
    ...STATIC_PII_RECOGNIZERS,
    ipAddressRecognizer(opts.includePrivateIps ?? false),
  ];
}
