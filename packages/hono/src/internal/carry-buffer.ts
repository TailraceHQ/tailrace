/**
 * Carry-buffer size for SSE hold-back (local copy of ai-sdk algorithm; docs/vault.md §5).
 *
 * Must not import @tailrace/ai-sdk (package boundary). Shared extraction deferred.
 */
export const CARRY_BUFFER_SIZE = 4096;
