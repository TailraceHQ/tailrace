/**
 * Streaming emit cut (docs/vault.md §5).
 *
 * Hold back a trailing window that might still grow into a match, and never bisect a
 * span that already reaches into that window - pull the cut back to the span start.
 */

export function computeStreamEmitEnd(
  length: number,
  spans: ReadonlyArray<{ start: number; end: number }>,
  holdback: number,
  final: boolean,
): number {
  if (final) return length;
  if (length <= holdback) return 0;

  let cut = length - holdback;
  for (const span of spans) {
    // Detected span straddles the tentative cut: keep the whole span in carry.
    if (span.start < cut && span.end > cut) {
      cut = Math.min(cut, span.start);
    }
  }
  return Math.max(0, cut);
}
