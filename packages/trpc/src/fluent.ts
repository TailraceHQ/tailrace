/**
 * Fluent Option C attach for tRPC helpers.
 */

import type { Tailrace } from "@tailrace/core";

import { createTailraceMiddleware } from "./middleware";
import type { TailraceTrpcOptions, TailraceWithTrpc } from "./types";

/**
 * Attach a `.middleware` helper to an existing Tailrace instance.
 *
 * @example
 * ```ts
 * const tr = withTrpc(createTailrace());
 * const procedure = t.procedure.use(tr.middleware({ agent: "api" }));
 * ```
 */
export function withTrpc(tailrace: Tailrace): TailraceWithTrpc {
  return Object.assign(tailrace, {
    middleware: (opts?: TailraceTrpcOptions) => createTailraceMiddleware(tailrace, opts),
  });
}
