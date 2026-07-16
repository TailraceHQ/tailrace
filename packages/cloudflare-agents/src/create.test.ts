import { describe, expect, it, vi } from "vitest";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { createCloudflareTailrace, withCloudflareAgents } from "./index";

const EMAIL = "user@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForFixturesOnly000FAKE";

function mockModel(): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId: "mock-1",
    defaultObjectGenerationMode: undefined,
    supportedUrls: undefined as never,
    doGenerate: async () => ({
      content: [{ type: "text", text: "ok" }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    }),
    doStream: async () => ({
      stream: new ReadableStream(),
      rawCall: { rawPrompt: undefined, rawSettings: {} },
    }),
  } as LanguageModelV2;
}

describe("createCloudflareTailrace", () => {
  it("uses memoryVault when kv omitted and still tokenizes", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tr = createCloudflareTailrace({}, { agent: "do-1", workflowId: "do-1" });
    const { output } = await tr.check(`hi ${EMAIL}`, {
      boundary: { kind: "tool", name: "crm", direction: "out" },
      identity: { agent: "do-1" },
      workflowId: "do-1",
    });
    expect(String(output)).toMatch(/EMAIL_/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("uses kvVault when kv provided", async () => {
    const store = new Map<string, string>();
    const kv = {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
    };
    const tr = createCloudflareTailrace(
      {},
      { agent: "do-2", workflowId: "do-2", kv, vaultKey: "a".repeat(64) },
    );
    const { output } = await tr.check(`hi ${EMAIL}`, {
      boundary: { kind: "tool", name: "crm", direction: "out" },
      identity: { agent: "do-2" },
      workflowId: "do-2",
    });
    expect(String(output)).toMatch(/EMAIL_/);
    expect(store.size).toBeGreaterThan(0);
  });
});

describe("withCloudflareAgents", () => {
  it("forChat wraps tools via ai-sdk", async () => {
    const tr = createCloudflareTailrace(
      {},
      { agent: "chat", workflowId: "chat", vaultKey: "b".repeat(64) },
    );
    const api = withCloudflareAgents(tr, { agent: "chat", workflowId: "chat" });
    const toolsIn = {
      crm: tool({
        description: "crm",
        inputSchema: z.object({ email: z.string() }),
        execute: async (args) => {
          expect(args.email).toMatch(/^<EMAIL_/);
          return args;
        },
      }),
    } satisfies ToolSet;

    const { tools } = api.forChat({
      model: mockModel(),
      tools: toolsIn,
    });

    const crm = tools.crm;
    expect(crm?.execute).toBeTypeOf("function");
    const result = await crm!.execute!({ email: EMAIL }, { toolCallId: "1", messages: [] });
    expect(result).toMatchObject({ email: expect.stringMatching(/^<EMAIL_/) });
  });

  it("wrapOnToolCall blocks secrets before handler", async () => {
    const tr = createCloudflareTailrace(
      {},
      { agent: "client", workflowId: "client", vaultKey: "c".repeat(64) },
    );
    const api = withCloudflareAgents(tr, { agent: "client", workflowId: "client" });
    let ran = false;
    const onToolCall = api.wrapOnToolCall(async () => {
      ran = true;
    });

    let output: unknown;
    await onToolCall({
      toolCall: {
        toolCallId: "1",
        toolName: "post",
        args: { body: FAKE_KEY },
      },
      addToolOutput: ({ output: o }) => {
        output = o;
      },
    });

    expect(ran).toBe(false);
    expect(String(output)).toMatch(/api_key/);
  });
});
