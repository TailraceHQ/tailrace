/**
 * createCloudflareTailrace — Tailrace wired for Workers / Durable Objects.
 */

import { createTailrace, kvVault, memoryVault } from "@tailrace/core";
import type { Tailrace } from "@tailrace/core";

import type { CloudflareTailraceOptions } from "./types";

function warnMemoryVault(): void {
  // why: Workers lose memoryVault on isolate recycle; prefer KV in production.
  const g = globalThis as { console?: { warn?: (...args: unknown[]) => void } };
  g.console?.warn?.(
    "[tailrace] createCloudflareTailrace: no kv binding; using memoryVault (not durable across isolates).",
  );
}

/**
 * Create a Tailrace instance for Cloudflare Agents.
 *
 * Uses `kvVault(kv)` when `opts.kv` is provided; otherwise `memoryVault()` with a warning.
 *
 * @example
 * ```ts
 * const tr = createCloudflareTailrace(env, {
 *   agent: this.name,
 *   workflowId: this.name,
 *   kv: env.TAILRACE_VAULT,
 * });
 * ```
 */
export function createCloudflareTailrace(
  _env: unknown,
  opts: CloudflareTailraceOptions = {},
): Tailrace {
  const createOptions = opts.createOptions ?? {};

  const vault =
    opts.kv !== undefined
      ? kvVault(opts.kv, opts.vaultKey !== undefined ? { key: opts.vaultKey } : undefined)
      : (warnMemoryVault(),
        memoryVault(opts.vaultKey !== undefined ? { key: opts.vaultKey } : undefined));

  const onDecision = opts.onDecision ?? createOptions.onDecision;

  return createTailrace({
    ...createOptions,
    vault,
    ...(onDecision !== undefined ? { onDecision } : {}),
  });
}

export function resolveCfWorkflowId(opts: CloudflareTailraceOptions): string {
  if (opts.workflowId !== undefined) {
    return typeof opts.workflowId === "function" ? opts.workflowId() : opts.workflowId;
  }
  return opts.agent ?? "default";
}

export function resolveCfAgent(opts: CloudflareTailraceOptions): string {
  return opts.agent ?? "default";
}
