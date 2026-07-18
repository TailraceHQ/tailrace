/**
 * BIOES label sequence → character spans (port of openai/privacy-filter spans helpers).
 * Character offsets are UTF-16 code units (JS string indices), matching Tailrace Span.
 */

import type { LabelInfo } from "./label-info";

/** Token-index span: [spanLabelIdx, tokenStart, tokenEndExclusive]. */
export type TokenSpan = readonly [labelIdx: number, start: number, end: number];

/** Char-index span: [spanLabelIdx, charStart, charEndExclusive]. */
export type CharSpan = readonly [labelIdx: number, start: number, end: number];

export function labelsToSpans(
  labelsByIndex: ReadonlyMap<number, number>,
  labelInfo: LabelInfo,
): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let currentLabel: number | null = null;
  let startIdx: number | null = null;
  let previousIdx: number | null = null;
  const { backgroundSpanLabel, tokenToSpanLabel, tokenBoundaryTags } = labelInfo;

  const sorted = [...labelsByIndex.keys()].sort((a, b) => a - b);
  for (const tokenIdx of sorted) {
    const labelId = labelsByIndex.get(tokenIdx)!;
    const spanLabel = tokenToSpanLabel.get(labelId);
    const boundaryTag = tokenBoundaryTags.get(labelId) ?? null;

    if (previousIdx !== null && tokenIdx !== previousIdx + 1) {
      if (currentLabel !== null && startIdx !== null) {
        spans.push([currentLabel, startIdx, previousIdx + 1]);
      }
      currentLabel = null;
      startIdx = null;
    }

    if (spanLabel === undefined) {
      previousIdx = tokenIdx;
      continue;
    }

    if (spanLabel === backgroundSpanLabel) {
      if (currentLabel !== null && startIdx !== null) {
        spans.push([currentLabel, startIdx, tokenIdx]);
      }
      currentLabel = null;
      startIdx = null;
      previousIdx = tokenIdx;
      continue;
    }

    if (boundaryTag === "S") {
      if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
        spans.push([currentLabel, startIdx, previousIdx + 1]);
      }
      spans.push([spanLabel, tokenIdx, tokenIdx + 1]);
      currentLabel = null;
      startIdx = null;
    } else if (boundaryTag === "B") {
      if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
        spans.push([currentLabel, startIdx, previousIdx + 1]);
      }
      currentLabel = spanLabel;
      startIdx = tokenIdx;
    } else if (boundaryTag === "I") {
      if (currentLabel === null || currentLabel !== spanLabel) {
        if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
          spans.push([currentLabel, startIdx, previousIdx + 1]);
        }
        currentLabel = spanLabel;
        startIdx = tokenIdx;
      }
    } else if (boundaryTag === "E") {
      if (currentLabel === null || currentLabel !== spanLabel || startIdx === null) {
        if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
          spans.push([currentLabel, startIdx, previousIdx + 1]);
        }
        spans.push([spanLabel, tokenIdx, tokenIdx + 1]);
        currentLabel = null;
        startIdx = null;
      } else {
        spans.push([currentLabel, startIdx, tokenIdx + 1]);
        currentLabel = null;
        startIdx = null;
      }
    } else if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
      spans.push([currentLabel, startIdx, previousIdx + 1]);
      currentLabel = null;
      startIdx = null;
    }

    previousIdx = tokenIdx;
  }

  if (currentLabel !== null && startIdx !== null && previousIdx !== null) {
    spans.push([currentLabel, startIdx, previousIdx + 1]);
  }
  return spans;
}

export function tokenSpansToCharSpans(
  spans: readonly TokenSpan[],
  charStarts: readonly number[],
  charEnds: readonly number[],
): CharSpan[] {
  const converted: CharSpan[] = [];
  for (const [labelIdx, tokenStart, tokenEnd] of spans) {
    if (!(0 <= tokenStart && tokenStart < tokenEnd && tokenEnd <= charStarts.length)) {
      continue;
    }
    const charStart = charStarts[tokenStart]!;
    const charEnd = charEnds[tokenEnd - 1]!;
    if (charEnd <= charStart) continue;
    converted.push([labelIdx, charStart, charEnd]);
  }
  return converted;
}

export function trimCharSpansWhitespace(spans: readonly CharSpan[], text: string): CharSpan[] {
  const trimmed: CharSpan[] = [];
  for (const [labelIdx, start0, end0] of spans) {
    let start = start0;
    let end = end0;
    if (!(0 <= start && start < end && end <= text.length)) continue;
    while (start < end && /\s/.test(text[start]!)) start++;
    while (end > start && /\s/.test(text[end - 1]!)) end--;
    if (end > start) trimmed.push([labelIdx, start, end]);
  }
  return trimmed;
}
