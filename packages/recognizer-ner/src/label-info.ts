/** Label-space tables for BIOES / Viterbi (port of openai/privacy-filter LabelInfo). */

import { RecognizerError } from "@tailrace/core";

export interface LabelInfo {
  tokenToSpanLabel: Map<number, number>;
  tokenBoundaryTags: Map<number, string | null>;
  spanClassNames: readonly string[];
  backgroundTokenLabel: number;
  backgroundSpanLabel: number;
}

/**
 * Build label-info from token-level class names (`O`, `B-…`, `I-…`, `E-…`, `S-…`).
 */
export function buildLabelInfo(classNames: readonly string[]): LabelInfo {
  const spanClassNames: string[] = ["O"];
  const spanLabelLookup = new Map<string, number>([["O", 0]]);
  const tokenToSpanLabel = new Map<number, number>();
  const tokenBoundaryTags = new Map<number, string | null>();
  let backgroundTokenLabel: number | null = null;

  for (let idx = 0; idx < classNames.length; idx++) {
    const name = classNames[idx]!;
    if (name === "O") {
      backgroundTokenLabel = idx;
      tokenToSpanLabel.set(idx, 0);
      tokenBoundaryTags.set(idx, null);
      continue;
    }
    const dash = name.indexOf("-");
    if (dash < 0) {
      throw new RecognizerError(`invalid BIOES class name: ${name}`);
    }
    const boundary = name.slice(0, dash);
    const baseLabel = name.slice(dash + 1);
    let spanIdx = spanLabelLookup.get(baseLabel);
    if (spanIdx === undefined) {
      spanIdx = spanClassNames.length;
      spanClassNames.push(baseLabel);
      spanLabelLookup.set(baseLabel, spanIdx);
    }
    tokenToSpanLabel.set(idx, spanIdx);
    tokenBoundaryTags.set(idx, boundary);
  }

  if (backgroundTokenLabel === null) {
    throw new RecognizerError("class names must include background label O");
  }

  return {
    tokenToSpanLabel,
    tokenBoundaryTags,
    spanClassNames,
    backgroundTokenLabel,
    backgroundSpanLabel: 0,
  };
}
