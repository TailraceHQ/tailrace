/**
 * Public types for @tailrace/http.
 */

import type { Decision } from "@tailrace/core";

/**
 * Identity / audit options for OpenAI-compat pipeline helpers.
 * Host adapters resolve agent/workflowId from their request, then pass strings here.
 */
export interface OpenAiCompatIdentityOpts {
  agent?: string;
  workflowId?: string;
  onDecision?: (decisions: Decision[]) => void;
}

/** Shared options shape documented for gateway packages (host adapters specialize `req`). */
export interface OpenAiCompatHttpOptionsBase {
  mode?: "openai-compatible";
  onDecision?: (decisions: Decision[]) => void;
}
