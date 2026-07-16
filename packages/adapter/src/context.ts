/**
 * Build CheckContext from adapter options + boundary.
 */

import type {
  Boundary,
  CheckContext,
  CheckOptions,
  CheckResult,
  JsonObject,
  Tailrace,
} from "@tailrace/core";

import type { AdapterWrapOptions } from "./types";

export function resolveWorkflowId(
  opts?: Pick<AdapterWrapOptions, "workflowId"> | { workflowId?: string | (() => string) },
): string {
  const raw = opts?.workflowId;
  if (raw === undefined) return "default";
  return typeof raw === "function" ? raw() : raw;
}

export function buildCheckContext(
  boundary: Boundary,
  opts?: AdapterWrapOptions | { agent?: string; workflowId?: string | (() => string) },
): CheckContext {
  return {
    boundary,
    identity: { agent: opts?.agent ?? "default" },
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
  opts?:
    | AdapterWrapOptions
    | {
        agent?: string;
        workflowId?: string | (() => string);
        onDecision?: AdapterWrapOptions["onDecision"];
      },
  checkOptions?: CheckOptions,
): Promise<CheckResult<T>> {
  const ctx = buildCheckContext(boundary, opts);
  const result = await tailrace.check(input, ctx, checkOptions);
  if (opts?.onDecision !== undefined && result.decisions.length > 0) {
    opts.onDecision(result.decisions);
  }
  return result;
}
