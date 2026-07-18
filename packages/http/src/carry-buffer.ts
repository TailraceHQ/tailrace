/**
 * Carry-buffer size for SSE hold-back (same algorithm as ai-sdk; docs/vault.md §5).
 *
 * Must not import @tailrace/ai-sdk (package boundary).
 */
export const CARRY_BUFFER_SIZE = 4096;
