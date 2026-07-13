/**
 * Fluent MCP helpers without core importing the MCP SDK (docs/integrations.md §2).
 */

import type { Tailrace } from "@tailrace/core";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import type { McpWrapOptions, TailraceWithMcp } from "./types";
import { wrapTransport } from "./wrap-transport";

/**
 * Attach a `transport` helper to an existing Tailrace instance.
 *
 * @example
 * ```ts
 * const tailrace = withMcp(createTailrace());
 * const transport = tailrace.transport(sseTransport, { server: "salesforce" });
 * ```
 */
export function withMcp(tailrace: Tailrace): TailraceWithMcp {
  return Object.assign(tailrace, {
    transport: <T extends Transport>(transport: T, opts: McpWrapOptions) =>
      wrapTransport(tailrace, transport, opts),
  });
}
