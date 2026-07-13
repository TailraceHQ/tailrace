/**
 * wrapTransport unit tests: tools/call out/in, resources/read in, JSON-RPC errors.
 */

import { describe, expect, it, vi } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { wrapTransport } from "./wrap-transport";
import { withMcp } from "./fluent";
import { POLICY_VIOLATION_RPC_CODE } from "./internal/jsonrpc";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "mcp@example.com";

function createFakeTransport(): Transport & {
  sent: JSONRPCMessage[];
  closed: boolean;
} {
  const sent: JSONRPCMessage[] = [];
  const t: Transport & { sent: JSONRPCMessage[]; closed: boolean } = {
    sent,
    closed: false,
    async start() {
      /* no-op */
    },
    async send(message) {
      sent.push(message);
    },
    async close() {
      t.closed = true;
    },
  };
  return t;
}

function toolsCallRequest(id: number, name: string, args: Record<string, unknown>): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

function toolsCallResult(id: number, text: string): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text }] },
  };
}

function resourcesReadRequest(id: number, uri: string): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    method: "resources/read",
    params: { uri },
  };
}

function resourcesReadResult(id: number, text: string): JSONRPCMessage {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      contents: [{ uri: "file:///doc.txt", mimeType: "text/plain", text }],
    },
  };
}

describe("wrapTransport tools/call outbound", () => {
  it("synthesizes JSON-RPC error on secret and keeps transport open", async () => {
    const inner = createFakeTransport();
    const received: JSONRPCMessage[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-out-secret" }) });
    const transport = wrapTransport(tailrace, inner, { server: "salesforce", workflowId: "w1" });
    transport.onmessage = (msg) => {
      received.push(msg);
    };

    await transport.send(toolsCallRequest(1, "create_lead", { note: `key ${SECRET}` }));

    expect(inner.sent).toHaveLength(0);
    expect(inner.closed).toBe(false);
    expect(received).toHaveLength(1);
    const errMsg = received[0] as {
      error?: { code: number; data?: { type: string; entity: string } };
    };
    expect(errMsg.error?.code).toBe(POLICY_VIOLATION_RPC_CODE);
    expect(errMsg.error?.data?.type).toBe("policy_violation");
    expect(errMsg.error?.data?.entity).toBe("api_key");
    expect(JSON.stringify(received[0])).not.toContain(SECRET);
  });

  it("tokenizes email in tool arguments before send", async () => {
    const inner = createFakeTransport();
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-out-email" }) });
    const transport = wrapTransport(tailrace, inner, { server: "salesforce", workflowId: "w2" });

    await transport.send(toolsCallRequest(2, "create_lead", { email: EMAIL }));

    expect(inner.sent).toHaveLength(1);
    const sent = inner.sent[0] as {
      params?: { arguments?: { email?: string } };
    };
    expect(sent.params?.arguments?.email).toBeDefined();
    expect(sent.params?.arguments?.email).not.toContain(EMAIL);
    expect(sent.params?.arguments?.email).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("passes unrelated methods through untouched", async () => {
    const inner = createFakeTransport();
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-pass" }) });
    const transport = wrapTransport(tailrace, inner, { server: "salesforce" });
    const ping: JSONRPCMessage = { jsonrpc: "2.0", id: 9, method: "ping" };
    await transport.send(ping);
    expect(inner.sent).toEqual([ping]);
  });
});

describe("wrapTransport tools/call inbound", () => {
  it("replaces inbound secret result with JSON-RPC error", async () => {
    const inner = createFakeTransport();
    const received: JSONRPCMessage[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-in-secret" }) });
    const transport = wrapTransport(tailrace, inner, { server: "salesforce", workflowId: "w3" });
    transport.onmessage = (msg) => {
      received.push(msg);
    };

    await transport.send(toolsCallRequest(3, "get_secret", { q: "x" }));
    expect(inner.sent).toHaveLength(1);

    transport.onmessage!(toolsCallResult(3, `leak ${SECRET}`));
    await vi.waitFor(() => expect(received.length).toBe(1));

    const last = received[0] as {
      error?: { code: number; data?: { entity: string } };
    };
    expect(last.error?.code).toBe(POLICY_VIOLATION_RPC_CODE);
    expect(last.error?.data?.entity).toBe("api_key");
    expect(JSON.stringify(last)).not.toContain(SECRET);
    expect(inner.closed).toBe(false);
  });

  it("tokenizes email in inbound tool result", async () => {
    const inner = createFakeTransport();
    const received: JSONRPCMessage[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-in-email" }) });
    const transport = wrapTransport(tailrace, inner, { server: "salesforce", workflowId: "w4" });
    transport.onmessage = (msg) => {
      received.push(msg);
    };

    await transport.send(toolsCallRequest(4, "get_contact", {}));
    transport.onmessage!(toolsCallResult(4, `contact ${EMAIL}`));
    await vi.waitFor(() => expect(received.length).toBe(1));

    const result = received[0] as { result?: { content?: Array<{ text?: string }> } };
    const text = result.result?.content?.[0]?.text ?? "";
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("wrapTransport resources/read inbound", () => {
  it("scans resources/read results with tool=read", async () => {
    const inner = createFakeTransport();
    const received: JSONRPCMessage[] = [];
    const decisions: Array<{ boundary: { tool: string } }> = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "mcp-res" }) });
    const transport = wrapTransport(tailrace, inner, {
      server: "docs",
      workflowId: "w5",
      onDecision: (ds) => {
        for (const d of ds) {
          decisions.push(d as { boundary: { tool: string } });
        }
      },
    });
    transport.onmessage = (msg) => {
      received.push(msg);
    };

    await transport.send(resourcesReadRequest(5, "file:///secret.txt"));
    transport.onmessage!(resourcesReadResult(5, `body ${EMAIL}`));
    await vi.waitFor(() => expect(received.length).toBe(1));

    const text = (received[0] as { result?: { contents?: Array<{ text?: string }> } }).result
      ?.contents?.[0]?.text;
    expect(text).toBeDefined();
    expect(text).not.toContain(EMAIL);
    expect(decisions.some((d) => d.boundary.tool === "read")).toBe(true);
  });
});

describe("withMcp fluent", () => {
  it("exposes transport helper", async () => {
    const inner = createFakeTransport();
    const tailrace = withMcp(createTailrace({ vault: memoryVault({ key: "mcp-fluent" }) }));
    const transport = tailrace.transport(inner, { server: "s" });
    await transport.send({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(inner.sent).toHaveLength(1);
  });
});
