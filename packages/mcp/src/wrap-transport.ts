/**
 * wrapTransport — MCP client transport proxy (docs/integrations.md §2).
 */

import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCMessage,
  MessageExtraInfo,
  RequestId,
} from "@modelcontextprotocol/sdk/types.js";

import { checkWithOpts } from "./internal/context";
import { isJsonRpcRequest, isJsonRpcResponse, policyViolationRpcError } from "./internal/jsonrpc";
import {
  asCheckable,
  getToolsCallArguments,
  getToolsCallName,
  unwrapCheckable,
  withRewrittenArguments,
} from "./internal/messages";
import type { McpWrapOptions } from "./types";

interface PendingCall {
  method: "tools/call" | "resources/read";
  tool: string;
}

/**
 * Wrap an MCP client transport so its calls pass through policy. Returns the same transport type.
 *
 * @example
 * ```ts
 * const transport = wrapTransport(tailrace, sseTransport, { server: "salesforce" });
 * ```
 */
export function wrapTransport<T extends Transport>(
  tailrace: Tailrace,
  transport: T,
  opts: McpWrapOptions,
): T {
  const pending = new Map<string, PendingCall>();
  const originalSend = transport.send.bind(transport);

  let userOnMessage: Transport["onmessage"] = transport.onmessage;

  const deliver = (message: JSONRPCMessage, extra?: MessageExtraInfo): void => {
    userOnMessage?.(message, extra);
  };

  const pendingKey = (id: RequestId): string => String(id);

  const wrappedOnMessage = (message: JSONRPCMessage, extra?: MessageExtraInfo): void => {
    void processInbound(message, extra);
  };

  async function processInbound(message: JSONRPCMessage, extra?: MessageExtraInfo): Promise<void> {
    if (!isJsonRpcResponse(message) || !("result" in message)) {
      deliver(message, extra);
      return;
    }

    const key = pendingKey(message.id);
    const info = pending.get(key);
    if (info === undefined) {
      deliver(message, extra);
      return;
    }
    pending.delete(key);

    const boundary = {
      kind: "mcp" as const,
      server: opts.server,
      tool: info.tool,
      direction: "in" as const,
    };

    try {
      const { output } = await checkWithOpts(tailrace, asCheckable(message.result), boundary, opts);
      const rewritten = {
        ...message,
        result: unwrapCheckable(message.result, output),
      } as JSONRPCMessage;
      deliver(rewritten, extra);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        deliver(policyViolationRpcError(message.id, err), extra);
        return;
      }
      throw err;
    }
  }

  transport.send = async (
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> => {
    if (!isJsonRpcRequest(message)) {
      return originalSend(message, options);
    }

    if (message.method === "tools/call") {
      const tool = getToolsCallName(message.params) ?? "unknown";
      const args = getToolsCallArguments(message.params);
      const boundary = {
        kind: "mcp" as const,
        server: opts.server,
        tool,
        direction: "out" as const,
      };

      try {
        const { output } = await checkWithOpts(tailrace, asCheckable(args), boundary, opts);
        const checkedArgs = unwrapCheckable(args, output);
        const nextParams = withRewrittenArguments(message.params, checkedArgs);
        const nextMessage = {
          ...message,
          params: nextParams,
        } as JSONRPCMessage;
        pending.set(pendingKey(message.id), { method: "tools/call", tool });
        return originalSend(nextMessage, options);
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          deliver(policyViolationRpcError(message.id, err));
          return;
        }
        throw err;
      }
    }

    if (message.method === "resources/read") {
      // Outbound resources/read params are not scanned in v0.1; track for inbound result scan.
      pending.set(pendingKey(message.id), { method: "resources/read", tool: "read" });
      return originalSend(message, options);
    }

    return originalSend(message, options);
  };

  Object.defineProperty(transport, "onmessage", {
    configurable: true,
    enumerable: true,
    get: () => wrappedOnMessage,
    set: (cb: Transport["onmessage"]) => {
      userOnMessage = cb;
    },
  });

  return transport;
}
