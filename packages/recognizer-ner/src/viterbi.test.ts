import { describe, expect, it } from "vitest";

import { buildLabelInfo } from "./label-info";
import { PRIVACY_FILTER_ID2LABEL } from "./labels";
import { logitsToLogProbs, ViterbiCrfDecoder, ZERO_VITERBI_BIASES } from "./viterbi";

describe("ViterbiCrfDecoder", () => {
  const labelInfo = buildLabelInfo(PRIVACY_FILTER_ID2LABEL);
  const decoder = new ViterbiCrfDecoder(labelInfo, ZERO_VITERBI_BIASES);
  const numClasses = PRIVACY_FILTER_ID2LABEL.length;

  it("decodes a single-token S-private_person span", () => {
    const seqLen = 3;
    const logits = new Float32Array(seqLen * numClasses);
    // Prefer O everywhere, except token 1 → S-private_person (index 20)
    for (let t = 0; t < seqLen; t++) {
      logits[t * numClasses + 0] = 5;
    }
    logits[1 * numClasses + 0] = 0;
    logits[1 * numClasses + 20] = 10;

    const logprobs = logitsToLogProbs(logits, seqLen, numClasses);
    const path = decoder.decode(logprobs, seqLen, numClasses);
    expect(path[0]).toBe(0);
    expect(path[1]).toBe(20);
    expect(path[2]).toBe(0);
  });

  it("enforces B-I-E coherence for multi-token secret", () => {
    const seqLen = 4;
    const logits = new Float32Array(seqLen * numClasses);
    for (let t = 0; t < seqLen; t++) {
      logits[t * numClasses + 0] = 2;
    }
    // B-secret=29, I-secret=30, E-secret=31
    logits[1 * numClasses + 0] = 0;
    logits[1 * numClasses + 29] = 8;
    logits[2 * numClasses + 0] = 0;
    logits[2 * numClasses + 30] = 8;
    logits[3 * numClasses + 0] = 0;
    logits[3 * numClasses + 31] = 8;

    const logprobs = logitsToLogProbs(logits, seqLen, numClasses);
    const path = decoder.decode(logprobs, seqLen, numClasses);
    expect(path.slice(1)).toEqual([29, 30, 31]);
  });
});
