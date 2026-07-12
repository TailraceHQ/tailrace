/**
 * Build CheckContext from wrap options + boundary.
 */

import type { Boundary, CheckContext, Decision, Tailrace } from "@tailrace/core";

import type { AiSdkWrapOptions } from "../types";

export function resolveWorkflowId(opts?: AiSdkWrapOptions): string {
  const raw = opts?.workflowId;
  if (raw === undefined) return "default";
  return typeof raw === "function" ? raw() : raw;
}

export function buildCheckContext(boundary: Boundary, opts?: AiSdkWrapOptions): CheckContext {
  return {
    boundary,
    identity: { agent: opts?.agent ?? "default" },
    workflowId: resolveWorkflowId(opts),
  };
}

/**
 * Run check and forward decisions to the optional wrap-level onDecision callback.
 */
export async function checkWithOpts<T extends string | import("@tailrace/core").JsonObject>(
  tailrace: Tailrace,
  input: T,
  boundary: Boundary,
  opts?: AiSdkWrapOptions,
  checkOptions?: { applyBlockAs?: "mask" },
): Promise<{ output: T; decisions: Decision[] }> {
  const ctx = buildCheckContext(boundary, opts);
  const result = await tailrace.check(input, ctx, checkOptions);
  if (opts?.onDecision !== undefined && result.decisions.length > 0) {
    opts.onDecision(result.decisions);
  }
  return { output: result.output, decisions: result.decisions };
}
