/**
 * createTailraceMiddleware — tRPC procedure middleware (docs/integrations.md §14).
 *
 * Non-streaming queries/mutations only in v0.1 (streaming deferred).
 */

import {
  asCheckable,
  checkWithOpts,
  formatToolBlockError,
  unwrapCheckable,
} from "@tailrace/adapter";
import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import { TRPCError } from "@trpc/server";

import type { TailraceTrpcMiddleware, TailraceTrpcOptions, TrpcMiddlewareContext } from "./types";

function resolveInfo(
  opts: TailraceTrpcOptions | undefined,
  mw: { path: string; type: string; ctx: unknown; input: unknown },
): {
  agent: string;
  name: string;
  workflowId: string;
  onDecision?: TailraceTrpcOptions["onDecision"];
} {
  const info: TrpcMiddlewareContext = {
    path: mw.path,
    type: mw.type,
    ctx: mw.ctx,
    input: mw.input,
  };
  const agent = typeof opts?.agent === "function" ? opts.agent(info) : (opts?.agent ?? "default");
  const name = typeof opts?.name === "function" ? opts.name(info) : (opts?.name ?? mw.path);
  const workflowId =
    typeof opts?.workflowId === "function"
      ? opts.workflowId(info)
      : (opts?.workflowId ?? "default");
  const result: {
    agent: string;
    name: string;
    workflowId: string;
    onDecision?: TailraceTrpcOptions["onDecision"];
  } = { agent, name, workflowId };
  if (opts?.onDecision !== undefined) {
    result.onDecision = opts.onDecision;
  }
  return result;
}

function toTrpcError(err: PolicyViolationError): TRPCError {
  return new TRPCError({
    code: "BAD_REQUEST",
    message: formatToolBlockError(err),
  });
}

/**
 * Build a tRPC middleware that checks procedure input (`out`) and result (`in`)
 * at the tool boundary.
 *
 * @example
 * ```ts
 * const governed = createTailraceMiddleware(tailrace, { agent: "api" });
 * const procedure = t.procedure.use(governed);
 * ```
 */
export function createTailraceMiddleware(
  tailrace: Tailrace,
  opts?: TailraceTrpcOptions,
  // why: `@trpc/server` MiddlewareFunction generics differ by major; `any` keeps `.use()` assignable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // SPEC-QUESTION: tRPC streaming procedures are out of scope for v0.1; document only.
  const mw: TailraceTrpcMiddleware = async (mwOpts) => {
    const { agent, name, workflowId, onDecision } = resolveInfo(opts, mwOpts);
    const adapterOpts = {
      agent,
      workflowId,
      ...(onDecision !== undefined ? { onDecision } : {}),
    };

    let nextInput = mwOpts.input;
    try {
      const checkable = asCheckable(mwOpts.input);
      const { output } = await checkWithOpts(
        tailrace,
        checkable,
        { kind: "tool", name, direction: "out" },
        adapterOpts,
      );
      nextInput = unwrapCheckable(mwOpts.input, output);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw toTrpcError(err);
      }
      throw err;
    }

    const result = (await mwOpts.next({ input: nextInput })) as {
      ok: boolean;
      data?: unknown;
      error?: unknown;
      marker?: string;
    };

    if (!result.ok) {
      return result;
    }

    try {
      const checkable = asCheckable(result.data);
      const { output } = await checkWithOpts(
        tailrace,
        checkable,
        { kind: "tool", name, direction: "in" },
        adapterOpts,
      );
      const data = unwrapCheckable(result.data, output);
      return { ...result, ok: true as const, data };
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw toTrpcError(err);
      }
      throw err;
    }
  };

  return mw;
}
