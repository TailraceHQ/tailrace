/**
 * Carry-buffer size for streaming hold-back (docs/vault.md §5, integrations.md §1.4).
 *
 * Conservative fixed cap covering typical Tier 0 matchable spans (API keys, JWTs of
 * common size, emails, phones, label tokens). PEM private keys and very long JWTs may
 * exceed this; prefer `streamBlockBehavior: "buffer"` when those are in scope.
 */
export const CARRY_BUFFER_SIZE = 128;

/**
 * Hold-back helper: given accumulated unscanned text, return `{ emit, carry }` where
 * `carry` is the trailing prefix that might still grow into a match, and `emit` is safe
 * to release (empty when `final` is false and the whole buffer fits in the carry window).
 */
export function splitCarry(
  buffer: string,
  carrySize: number = CARRY_BUFFER_SIZE,
  final = false,
): { emit: string; carry: string } {
  if (final || buffer.length <= carrySize) {
    return final ? { emit: buffer, carry: "" } : { emit: "", carry: buffer };
  }
  const emit = buffer.slice(0, buffer.length - carrySize);
  const carry = buffer.slice(buffer.length - carrySize);
  return { emit, carry };
}
