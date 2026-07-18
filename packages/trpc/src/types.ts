/**
 * Public types for @tailrace/trpc.
 */

import type { Decision, Tailrace } from "@tailrace/core";

/** Fields available when resolving agent / tool name / workflowId. */
export interface TrpcMiddlewareContext {
  path: string;
  type: string;
  ctx: unknown;
  input: unknown;
}

export interface TailraceTrpcOptions {
  /** Static agent, or derive from middleware context. Defaults to `"default"`. */
  agent?: string | ((info: TrpcMiddlewareContext) => string);
  /**
   * Tool name for the boundary. Defaults to procedure `path`
   * (e.g. `"chat.completions"`).
   */
  name?: string | ((info: TrpcMiddlewareContext) => string);
  /** Static or derived workflow id. Defaults to `"default"`. */
  workflowId?: string | ((info: TrpcMiddlewareContext) => string);
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Middleware function compatible with `t.procedure.use(...)`.
 * Typed loosely so it works across `@trpc/server` major versions; runtime shape
 * matches tRPC's MiddlewareResult discriminants (`ok: true` / `ok: false`).
 */
// why: tRPC MiddlewareFunction generics vary by version; keep public type assignable to `.use()`.
export type TailraceTrpcMiddleware = (opts: {
  path: string;
  type: string;
  ctx: unknown;
  input: unknown;
  next: (opts?: { input?: unknown }) => Promise<unknown>;
}) => Promise<unknown>;

export interface TailraceWithTrpc extends Tailrace {
  // why: same host-interop as createTailraceMiddleware — assignable to `.use()`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  middleware(opts?: TailraceTrpcOptions): any;
}
