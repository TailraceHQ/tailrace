/**
 * Public types for @tailrace/mcp.
 */

import type { Decision, Tailrace } from "@tailrace/core";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export interface McpWrapOptions {
  /** MCP server identity used in policy boundary keys (`mcp:{server}/{tool}`). */
  server: string;
  agent?: string;
  workflowId?: string;
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Tailrace instance with fluent MCP helpers. Produced by {@link withMcp};
 * core stays framework-free.
 */
export interface TailraceWithMcp extends Tailrace {
  transport<T extends Transport>(transport: T, opts: McpWrapOptions): T;
}
