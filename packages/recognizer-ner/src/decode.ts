/**
 * Logits → Tailrace spans: softmax, Viterbi, BIOES → char spans → entity map.
 */

import { RecognizerError } from "@tailrace/core";
import type { Span } from "@tailrace/core";

import { buildLabelInfo } from "./label-info";
import { mapModelLabelToEntity, NER_RECOGNIZER_ID, PRIVACY_FILTER_ID2LABEL } from "./labels";
import { labelsToSpans, tokenSpansToCharSpans, trimCharSpansWhitespace } from "./spans";
import type { TokenizedText } from "./tokenize";
import { logitsToLogProbs, ViterbiCrfDecoder, ZERO_VITERBI_BIASES } from "./viterbi";
import type { ViterbiBiases } from "./viterbi";

const labelInfo = buildLabelInfo(PRIVACY_FILTER_ID2LABEL);
const defaultDecoder = new ViterbiCrfDecoder(labelInfo, ZERO_VITERBI_BIASES);

export interface DecodeOptions {
  /** Flat logits [seqLen * numClasses]. */
  logits: ArrayLike<number>;
  seqLen: number;
  numClasses?: number;
  text: string;
  tokens: TokenizedText;
  biases?: ViterbiBiases;
  /** Confidence assigned to emitted spans. Default 0.85. */
  confidence?: number;
  recognizerId?: string;
}

/**
 * Decode Privacy Filter logits into Tailrace spans (UTF-16 offsets).
 */
export function decodePrivacyFilterLogits(opts: DecodeOptions): Span[] {
  const numClasses = opts.numClasses ?? PRIVACY_FILTER_ID2LABEL.length;
  const seqLen = opts.seqLen;
  if (seqLen !== opts.tokens.inputIds.length) {
    throw new RecognizerError("seqLen must match tokenized input length");
  }

  const logprobs = logitsToLogProbs(opts.logits, seqLen, numClasses);
  const decoder =
    opts.biases === undefined ? defaultDecoder : new ViterbiCrfDecoder(labelInfo, opts.biases);
  const labelIds = decoder.decode(logprobs, seqLen, numClasses);

  const labelsByIndex = new Map<number, number>();
  for (let i = 0; i < labelIds.length; i++) {
    labelsByIndex.set(i, labelIds[i]!);
  }

  const tokenSpans = labelsToSpans(labelsByIndex, labelInfo);
  const charSpans = trimCharSpansWhitespace(
    tokenSpansToCharSpans(tokenSpans, opts.tokens.charStarts, opts.tokens.charEnds),
    opts.text,
  );

  const confidence = opts.confidence ?? 0.85;
  const recognizer = opts.recognizerId ?? NER_RECOGNIZER_ID;
  const out: Span[] = [];

  for (const [spanLabelIdx, start, end] of charSpans) {
    const modelLabel = labelInfo.spanClassNames[spanLabelIdx];
    if (modelLabel === undefined || modelLabel === "O") continue;
    const entity = mapModelLabelToEntity(modelLabel);
    if (entity === null) continue;
    out.push({ entity, start, end, confidence, recognizer });
  }
  return out;
}
