/**
 * Build CheckContext from resolved identity opts + boundary.
 */

import type {
  Boundary,
  CheckContext,
  CheckOptions,
  CheckResult,
  JsonObject,
  Tailrace,
} from "@tailrace/core";

import type { OpenAiCompatIdentityOpts } from "./types";

export function resolveAgent(opts?: OpenAiCompatIdentityOpts): string {
  return opts?.agent ?? "default";
}

export function resolveWorkflowId(opts?: OpenAiCompatIdentityOpts): string {
  return opts?.workflowId ?? "default";
}

export function buildCheckContext(
  boundary: Boundary,
  opts?: OpenAiCompatIdentityOpts,
): CheckContext {
  return {
    boundary,
    identity: { agent: resolveAgent(opts) },
    workflowId: resolveWorkflowId(opts),
  };
}

/**
 * Run check and forward decisions to the optional onDecision callback.
 */
export async function checkWithOpts<T extends string | JsonObject>(
  tailrace: Tailrace,
  input: T,
  boundary: Boundary,
  opts?: OpenAiCompatIdentityOpts,
  checkOptions?: CheckOptions,
): Promise<CheckResult<T>> {
  const ctx = buildCheckContext(boundary, opts);
  const result = await tailrace.check(input, ctx, checkOptions);
  if (opts?.onDecision !== undefined && result.decisions.length > 0) {
    opts.onDecision(result.decisions);
  }
  return result;
}
