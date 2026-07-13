/**
 * Build CheckContext from Hono options + model boundary.
 */

import type {
  Boundary,
  CheckContext,
  CheckOptions,
  CheckResult,
  JsonObject,
  Tailrace,
} from "@tailrace/core";
import type { Context } from "hono";

import type { TailraceHonoOptions } from "../types";

export function resolveAgent(c: Context, opts?: TailraceHonoOptions): string {
  return opts?.agent?.(c) ?? "default";
}

export function resolveWorkflowId(c: Context, opts?: TailraceHonoOptions): string {
  const raw = opts?.workflowId;
  if (raw === undefined) return "default";
  return typeof raw === "function" ? raw(c) : raw;
}

export function buildCheckContext(
  c: Context,
  boundary: Boundary,
  opts?: TailraceHonoOptions,
): CheckContext {
  return {
    boundary,
    identity: { agent: resolveAgent(c, opts) },
    workflowId: resolveWorkflowId(c, opts),
  };
}

export async function checkWithOpts<T extends string | JsonObject>(
  tailrace: Tailrace,
  c: Context,
  input: T,
  boundary: Boundary,
  opts?: TailraceHonoOptions,
  checkOptions?: CheckOptions,
): Promise<CheckResult<T>> {
  const ctx = buildCheckContext(c, boundary, opts);
  const result = await tailrace.check(input, ctx, checkOptions);
  if (opts?.onDecision !== undefined && result.decisions.length > 0) {
    opts.onDecision(result.decisions);
  }
  return result;
}
