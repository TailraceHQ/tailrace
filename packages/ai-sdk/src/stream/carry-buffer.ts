/**
 * Carry-buffer size for streaming hold-back (docs/vault.md §5, integrations.md §1.4).
 *
 * Must be ≥ the longest Tier 0 matchable span we intend to hold without bisecting.
 * 4096 covers typical API keys, emails, and common JWTs. Unbounded PEM bodies and
 * pathological JWTs beyond this window require `streamBlockBehavior: "buffer"`.
 *
 * The emit cut is not purely length-based: after detection on the full buffer, any
 * span that straddles `len - holdback` pulls the cut back to that span's start
 * (`computeStreamEmitEnd` in @tailrace/core).
 */
export const CARRY_BUFFER_SIZE = 4096;
