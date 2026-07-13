/**
 * JSON-RPC helpers for MCP policy error synthesis (docs/integrations.md §2).
 */

import type { PolicyViolationError } from "@tailrace/core";
import type { JSONRPCError, JSONRPCMessage, RequestId } from "@modelcontextprotocol/sdk/types.js";

/** JSON-RPC application error for Tailrace policy blocks. */
export const POLICY_VIOLATION_RPC_CODE = -32001;

export function isJsonRpcRequest(
  message: JSONRPCMessage,
): message is JSONRPCMessage & { method: string; id: RequestId; params?: unknown } {
  return (
    typeof message === "object" &&
    message !== null &&
    "method" in message &&
    "id" in message &&
    !("result" in message) &&
    !("error" in message)
  );
}

export function isJsonRpcResponse(
  message: JSONRPCMessage,
): message is JSONRPCMessage & { id: RequestId } & ({ result: unknown } | { error: unknown }) {
  return (
    typeof message === "object" &&
    message !== null &&
    "id" in message &&
    ("result" in message || "error" in message) &&
    !("method" in message)
  );
}

/**
 * Build a JSON-RPC error response from a PolicyViolationError.
 * Never includes the raw detected value.
 */
export function policyViolationRpcError(id: RequestId, err: PolicyViolationError): JSONRPCError {
  const first = err.decisions[0];
  const entity = first?.entity ?? "unknown";
  const rule = first?.rule ?? "unknown";
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: POLICY_VIOLATION_RPC_CODE,
      message: `Blocked by data policy: ${entity} may not be sent to mcp (rule: ${rule})`,
      data: {
        type: "policy_violation",
        entity,
        rule,
      },
    },
  };
}
