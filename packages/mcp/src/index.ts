/**
 * @tailrace/mcp - MCP client transport wrapper.
 *
 * Intercepts outbound `tools/call` arguments and inbound results (and `resources/read`
 * results), applying policy at the `mcp` boundary. A blocked outbound call is turned into
 * a JSON-RPC error result rather than tearing down the transport (docs/integrations.md §2).
 * M0 skeleton: signature is stable, body lands in M5.
 */

import { NotImplementedError, type Decision, type Tailrace } from "@tailrace/core";

export interface McpWrapOptions {
  server: string;
  agent?: string;
  workflowId?: string;
  onDecision?: (decisions: Decision[]) => void;
}

// SPEC-QUESTION: bind the @modelcontextprotocol/sdk `Transport` type in M5, verified against
// the installed SDK's transport interface (docs/integrations.md §2). Tracked in OPEN_QUESTIONS.md.

/**
 * Wrap an MCP client transport so its calls pass through policy. Returns the same transport type.
 *
 * @example
 * ```ts
 * const transport = wrapTransport(tailrace, sseTransport, { server: "salesforce" });
 * ```
 */
export function wrapTransport<TTransport>(
  tailrace: Tailrace,
  transport: TTransport,
  opts: McpWrapOptions,
): TTransport {
  throw new NotImplementedError(
    "@tailrace/mcp wrapTransport lands in milestone M5 (docs/milestones.md)",
  );
}
