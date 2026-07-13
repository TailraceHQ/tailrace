/**
 * Build CheckContext from wrap options + mcp boundary.
 */

import type {
  Boundary,
  CheckContext,
  CheckOptions,
  CheckResult,
  JsonObject,
  Tailrace,
} from "@tailrace/core";

import type { McpWrapOptions } from "../types";

export function resolveWorkflowId(opts: McpWrapOptions): string {
  return opts.workflowId ?? "default";
}

export function buildCheckContext(boundary: Boundary, opts: McpWrapOptions): CheckContext {
  return {
    boundary,
    identity: { agent: opts.agent ?? "default" },
    workflowId: resolveWorkflowId(opts),
  };
}

/**
 * Run check and forward decisions to the optional wrap-level onDecision callback.
 */
export async function checkWithOpts<T extends string | JsonObject>(
  tailrace: Tailrace,
  input: T,
  boundary: Boundary,
  opts: McpWrapOptions,
  checkOptions?: CheckOptions,
): Promise<CheckResult<T>> {
  const ctx = buildCheckContext(boundary, opts);
  const result = await tailrace.check(input, ctx, checkOptions);
  if (opts.onDecision !== undefined && result.decisions.length > 0) {
    opts.onDecision(result.decisions);
  }
  return result;
}
