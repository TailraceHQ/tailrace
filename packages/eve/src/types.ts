/**
 * Public types for @tailrace/eve.
 *
 * Bound against eve@0.27.x: `defineTool` / `ToolDefinition` from `eve/tools`.
 * Structural shape kept (no runtime `eve` import) so the package builds without
 * the peer installed; `execute` matches `(input, ctx: ToolContext)`.
 */

import type { Decision, Tailrace } from "@tailrace/core";

export interface EveWrapOptions {
  agent?: string;
  /**
   * Prefer Eve's durable session id (`ctx.session.id`) so tokens stay stable
   * across Workflow replay. Resolution: `opts.workflowId` → `ctx.session.id` →
   * env `EVE_SESSION_ID` → `"default"`.
   */
  workflowId?: string | (() => string);
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Structural shape of an Eve tool definition (`ToolDefinition` from `eve/tools`).
 * `inputSchema` stays opaque to avoid a `zod` / Standard Schema dependency.
 *
 * `execute` uses method syntax so host generics stay assignable under
 * `strictFunctionTypes` (method params are bivariant).
 */
export interface EveToolDefinition<TInput = unknown, TOutput = unknown> {
  description: string;
  inputSchema: unknown;
  execute(input: TInput, ...rest: unknown[]): TOutput | Promise<TOutput>;
  [key: string]: unknown;
}

/**
 * Tailrace instance with fluent Eve helpers.
 */
export interface TailraceWithEve extends Tailrace {
  tool<D extends EveToolDefinition>(name: string, def: D, opts?: EveWrapOptions): D;
  tools<D extends Record<string, EveToolDefinition>>(defs: D, opts?: EveWrapOptions): D;
}
