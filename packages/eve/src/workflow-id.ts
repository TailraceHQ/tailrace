/**
 * Resolve workflowId for an Eve tool invocation (integrations.md §15).
 */

import type { EveWrapOptions } from "./types";

/**
 * Extract Eve's durable session id from `ToolContext` (`ctx.session.id`).
 */
export function sessionIdFromToolContext(ctx: unknown): string | undefined {
  if (ctx === null || typeof ctx !== "object") return undefined;
  const session = (ctx as { session?: unknown }).session;
  if (session === null || typeof session !== "object") return undefined;
  const id = (session as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function envEveSessionId(): string | undefined {
  // why: optional Node/edge env fallback without a hard `process` / `node:` import
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const v = env?.EVE_SESSION_ID;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolution order: `opts.workflowId` → `ctx.session.id` → `EVE_SESSION_ID` → `"default"`.
 */
export function resolveEveWorkflowId(opts: EveWrapOptions | undefined, ctx: unknown): string {
  if (opts?.workflowId !== undefined) {
    return typeof opts.workflowId === "function" ? opts.workflowId() : opts.workflowId;
  }
  return sessionIdFromToolContext(ctx) ?? envEveSessionId() ?? "default";
}
