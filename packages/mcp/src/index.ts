/**
 * @tailrace/mcp - MCP client transport wrapper.
 *
 * Intercepts outbound `tools/call` arguments and inbound results (and `resources/read`
 * results), applying policy at the `mcp` boundary. A blocked outbound call is turned into
 * a JSON-RPC error result rather than tearing down the transport (docs/integrations.md §2).
 */

export type { McpWrapOptions, TailraceWithMcp } from "./types";
export { wrapTransport } from "./wrap-transport";
export { withMcp } from "./fluent";
