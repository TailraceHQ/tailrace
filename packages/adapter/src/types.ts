/**
 * Public types for @tailrace/adapter.
 */

import type { Boundary, Decision } from "@tailrace/core";

export interface AdapterWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Invocation descriptor for {@link runGoverned}.
 * Caller supplies the boundary; adapter never invents policy.
 */
export interface GovernedInvocation {
  boundary: Boundary;
  input: unknown;
  agent?: string;
  workflowId?: string | (() => string);
  onDecision?: (decisions: Decision[]) => void;
  /** When true, also check the handler return value at the same boundary with direction flipped for tool/mcp. */
  checkResult?: boolean;
}

export interface GovernedResult<TOutput> {
  allowed: boolean;
  output?: TOutput;
  error?: string;
  decisions: Decision[];
}
