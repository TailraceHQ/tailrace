/**
 * @tailrace/hono - Hono middleware (OpenAI-compatible passthrough).
 *
 * Parses OpenAI-format chat bodies, applies policy at the `model` boundary, forwards, and
 * scans responses (including SSE streaming). A block becomes a 422 JSON error
 * (docs/integrations.md §3). Thin by design - serves Workers users and shapes a future
 * gateway plugin. M0 skeleton: signature is stable, body lands in M5.
 */

import { NotImplementedError, type Decision, type Tailrace } from "@tailrace/core";

export interface TailraceHonoOptions {
  mode?: "openai-compatible";
  /** Derive the acting agent from the request context. Defaults to `"default"`. */
  agent?: (ctx: unknown) => string;
  onDecision?: (decisions: Decision[]) => void;
}

/** A Hono-shaped middleware handler `(c, next) => Promise<void | Response>`. */
export type TailraceHonoMiddleware = (ctx: unknown, next: () => Promise<void>) => Promise<unknown>;

// SPEC-QUESTION: bind Hono's `MiddlewareHandler` / `Context` types in M5, verified against the
// installed `hono` version (docs/integrations.md §3). Tracked in OPEN_QUESTIONS.md.

/**
 * Build Tailrace middleware for a Hono app.
 *
 * @example
 * ```ts
 * app.use("/v1/*", tailraceHono(tailrace, { mode: "openai-compatible" }));
 * ```
 */
export function tailraceHono(
  tailrace: Tailrace,
  opts?: TailraceHonoOptions,
): TailraceHonoMiddleware {
  throw new NotImplementedError(
    "@tailrace/hono middleware lands in milestone M5 (docs/milestones.md)",
  );
}
