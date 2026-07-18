/**
 * Constrained BIOES Viterbi decoder (port of openai/privacy-filter ViterbiCRFDecoder).
 * Operates on log-probabilities shaped [seqLen, numClasses].
 */

import { RecognizerError } from "@tailrace/core";

import type { LabelInfo } from "./label-info";

const NEG_INF = -1e9;

export interface ViterbiBiases {
  transition_bias_background_stay: number;
  transition_bias_background_to_start: number;
  transition_bias_inside_to_continue: number;
  transition_bias_inside_to_end: number;
  transition_bias_end_to_background: number;
  transition_bias_end_to_start: number;
}

export const ZERO_VITERBI_BIASES: ViterbiBiases = {
  transition_bias_background_stay: 0,
  transition_bias_background_to_start: 0,
  transition_bias_inside_to_continue: 0,
  transition_bias_inside_to_end: 0,
  transition_bias_end_to_background: 0,
  transition_bias_end_to_start: 0,
};

export class ViterbiCrfDecoder {
  private readonly startScores: Float64Array;
  private readonly endScores: Float64Array;
  private readonly transitionScores: Float64Array;
  private readonly numClasses: number;

  constructor(
    private readonly labelInfo: LabelInfo,
    private readonly biases: ViterbiBiases = ZERO_VITERBI_BIASES,
  ) {
    this.numClasses = labelInfo.tokenToSpanLabel.size;
    this.startScores = new Float64Array(this.numClasses).fill(NEG_INF);
    this.endScores = new Float64Array(this.numClasses).fill(NEG_INF);
    this.transitionScores = new Float64Array(this.numClasses * this.numClasses).fill(NEG_INF);
    this.precompute();
  }

  private precompute(): void {
    const { backgroundTokenLabel, backgroundSpanLabel, tokenBoundaryTags, tokenToSpanLabel } =
      this.labelInfo;

    for (let idx = 0; idx < this.numClasses; idx++) {
      const tag = tokenBoundaryTags.get(idx) ?? null;
      if (tag === "B" || tag === "S" || idx === backgroundTokenLabel) {
        this.startScores[idx] = 0;
      }
      if (tag === "E" || tag === "S" || idx === backgroundTokenLabel) {
        this.endScores[idx] = 0;
      }

      const spanLabel = tokenToSpanLabel.get(idx);
      for (let nextIdx = 0; nextIdx < this.numClasses; nextIdx++) {
        const nextTag = tokenBoundaryTags.get(nextIdx) ?? null;
        const nextSpan = tokenToSpanLabel.get(nextIdx);
        if (
          !isValidTransition({
            prevTag: tag,
            prevSpan: spanLabel,
            nextTag,
            nextSpan,
            backgroundTokenLabel,
            backgroundSpanLabel,
            nextIdx,
          })
        ) {
          continue;
        }
        this.transitionScores[idx * this.numClasses + nextIdx] = this.transitionBias(
          tag,
          spanLabel,
          nextTag,
          nextSpan,
          idx,
          nextIdx,
        );
      }
    }
  }

  private transitionBias(
    prevTag: string | null,
    prevSpan: number | undefined,
    nextTag: string | null,
    nextSpan: number | undefined,
    prevIdx: number,
    nextIdx: number,
  ): number {
    const { backgroundTokenLabel, backgroundSpanLabel } = this.labelInfo;
    const prevIsBackground = prevSpan === backgroundSpanLabel || prevIdx === backgroundTokenLabel;
    const nextIsBackground = nextSpan === backgroundSpanLabel || nextIdx === backgroundTokenLabel;

    if (prevIsBackground) {
      if (nextIsBackground) return this.biases.transition_bias_background_stay;
      if (nextTag === "B" || nextTag === "S") {
        return this.biases.transition_bias_background_to_start;
      }
      return 0;
    }
    if (prevTag === "B" || prevTag === "I") {
      if (nextTag === "I" && prevSpan === nextSpan) {
        return this.biases.transition_bias_inside_to_continue;
      }
      if (nextTag === "E" && prevSpan === nextSpan) {
        return this.biases.transition_bias_inside_to_end;
      }
      return 0;
    }
    if (prevTag === "E" || prevTag === "S") {
      if (nextIsBackground) return this.biases.transition_bias_end_to_background;
      if (nextTag === "B" || nextTag === "S") {
        return this.biases.transition_bias_end_to_start;
      }
      return 0;
    }
    return 0;
  }

  /** Decode one sequence of log-probs into token label ids. */
  decode(tokenLogprobs: ArrayLike<number>, seqLen: number, numClasses: number): number[] {
    if (seqLen === 0) return [];
    if (numClasses !== this.numClasses) {
      throw new RecognizerError(`expected ${this.numClasses} classes, got ${numClasses}`);
    }

    let scores = new Float64Array(numClasses);
    for (let c = 0; c < numClasses; c++) {
      scores[c] = tokenLogprobs[c]! + this.startScores[c]!;
    }

    const backpointers = new Int32Array((seqLen - 1) * numClasses);

    for (let t = 1; t < seqLen; t++) {
      const nextScores = new Float64Array(numClasses);
      for (let next = 0; next < numClasses; next++) {
        let best = NEG_INF;
        let bestPrev = 0;
        for (let prev = 0; prev < numClasses; prev++) {
          const score = scores[prev]! + this.transitionScores[prev * numClasses + next]!;
          if (score > best) {
            best = score;
            bestPrev = prev;
          }
        }
        nextScores[next] = best + tokenLogprobs[t * numClasses + next]!;
        backpointers[(t - 1) * numClasses + next] = bestPrev;
      }
      scores = nextScores;
    }

    let anyFinite = false;
    for (let c = 0; c < numClasses; c++) {
      if (Number.isFinite(scores[c]!)) {
        anyFinite = true;
        break;
      }
    }
    if (!anyFinite) {
      const path: number[] = [];
      for (let t = 0; t < seqLen; t++) {
        let best = 0;
        let bestScore = -Infinity;
        for (let c = 0; c < numClasses; c++) {
          const v = tokenLogprobs[t * numClasses + c]!;
          if (v > bestScore) {
            bestScore = v;
            best = c;
          }
        }
        path.push(best);
      }
      return path;
    }

    for (let c = 0; c < numClasses; c++) {
      scores[c]! += this.endScores[c]!;
    }
    let last = 0;
    let lastScore = -Infinity;
    for (let c = 0; c < numClasses; c++) {
      if (scores[c]! > lastScore) {
        lastScore = scores[c]!;
        last = c;
      }
    }

    const path = new Array<number>(seqLen);
    path[seqLen - 1] = last;
    for (let t = seqLen - 2; t >= 0; t--) {
      last = backpointers[t * numClasses + last]!;
      path[t] = last;
    }
    return path;
  }
}

function isValidTransition(args: {
  prevTag: string | null;
  prevSpan: number | undefined;
  nextTag: string | null;
  nextSpan: number | undefined;
  backgroundTokenLabel: number;
  backgroundSpanLabel: number;
  nextIdx: number;
}): boolean {
  const {
    prevTag,
    prevSpan,
    nextTag,
    nextSpan,
    backgroundTokenLabel,
    backgroundSpanLabel,
    nextIdx,
  } = args;
  const nextIsBackground = nextSpan === backgroundSpanLabel || nextIdx === backgroundTokenLabel;
  if ((nextSpan === undefined || nextTag === null) && !nextIsBackground) return false;

  if (prevSpan === undefined || prevTag === null) {
    return nextIsBackground || nextTag === "B" || nextTag === "S";
  }

  const prevIsBackground = prevSpan === backgroundSpanLabel;
  if (prevIsBackground) {
    return nextIsBackground || nextTag === "B" || nextTag === "S";
  }
  if (prevTag === "E" || prevTag === "S") {
    return nextIsBackground || nextTag === "B" || nextTag === "S";
  }
  if (prevTag === "B" || prevTag === "I") {
    return prevSpan === nextSpan && (nextTag === "I" || nextTag === "E");
  }
  return false;
}

/** Softmax → log-probabilities for a flat [seqLen * numClasses] logits buffer. */
export function logitsToLogProbs(
  logits: ArrayLike<number>,
  seqLen: number,
  numClasses: number,
): Float64Array {
  const out = new Float64Array(seqLen * numClasses);
  for (let t = 0; t < seqLen; t++) {
    let max = -Infinity;
    const base = t * numClasses;
    for (let c = 0; c < numClasses; c++) {
      const v = logits[base + c]!;
      if (v > max) max = v;
    }
    let sum = 0;
    for (let c = 0; c < numClasses; c++) {
      sum += Math.exp(logits[base + c]! - max);
    }
    const logSum = Math.log(sum) + max;
    for (let c = 0; c < numClasses; c++) {
      out[base + c] = logits[base + c]! - logSum;
    }
  }
  return out;
}
