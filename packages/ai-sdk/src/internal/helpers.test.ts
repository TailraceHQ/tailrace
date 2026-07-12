/**
 * Unit tests for encodeModelProvider and message walk/rewrite.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import type { LanguageModelV2Prompt } from "@ai-sdk/provider";

import { encodeModelProvider } from "./provider";
import { checkPromptParams, extractPromptTextTree } from "./messages";

describe("encodeModelProvider", () => {
  it("combines providerId/modelId", () => {
    expect(encodeModelProvider({ provider: "openai", modelId: "gpt-4o" })).toBe("openai/gpt-4o");
  });

  it("uses gateway-style modelId as-is", () => {
    expect(encodeModelProvider({ provider: "gateway", modelId: "openai/gpt-4o" })).toBe(
      "openai/gpt-4o",
    );
  });

  it("falls back to provider when modelId is empty", () => {
    expect(encodeModelProvider({ provider: "openai", modelId: "" })).toBe("openai");
  });

  it("falls back to modelId when provider is empty", () => {
    expect(encodeModelProvider({ provider: "", modelId: "gpt-4o" })).toBe("gpt-4o");
  });
});

describe("extractPromptTextTree", () => {
  it("walks and rewrites text parts; skips file parts", async () => {
    const prompt: LanguageModelV2Prompt = [
      { role: "system", content: "sys customer@example.com" },
      {
        role: "user",
        content: [
          { type: "text", text: "hi customer@example.com" },
          { type: "file", mediaType: "image/png", data: "AAAA" },
        ],
      },
    ];
    const { tree, apply } = extractPromptTextTree(prompt);
    const messages = tree["messages"] as unknown[];
    expect(messages).toHaveLength(2);

    const tailrace = createTailrace({ vault: memoryVault({ key: "msg-key" }) });
    const { output } = await tailrace.check(tree, {
      boundary: { kind: "model", provider: "openai/gpt-4o" },
      identity: { agent: "default" },
      workflowId: "msg",
    });
    apply(output);

    expect(
      prompt[0]!.role === "system" && (prompt[0] as { content: string }).content,
    ).not.toContain("customer@example.com");
    const user = prompt[1]!;
    expect(user.role).toBe("user");
    if (user.role === "user") {
      const textPart = user.content[0];
      expect(textPart?.type).toBe("text");
      if (textPart?.type === "text") {
        expect(textPart.text).not.toContain("customer@example.com");
        expect(textPart.text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
      }
      // file part untouched
      expect(user.content[1]).toMatchObject({ type: "file" });
    }
  });
});

describe("checkPromptParams", () => {
  it("tokenizes emails in params and blocks secrets", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "params-key" }) });
    const email = "params@example.com";
    const { params } = await checkPromptParams(
      tailrace,
      {
        prompt: [{ role: "user", content: [{ type: "text", text: `hello ${email}` }] }],
      },
      { kind: "model", provider: "openai/gpt-4o" },
      { workflowId: "p1" },
    );
    const user = params.prompt[0]!;
    expect(user.role).toBe("user");
    if (user.role === "user" && user.content[0]?.type === "text") {
      expect(user.content[0].text).not.toContain(email);
    }

    const secret = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
    await expect(
      checkPromptParams(
        tailrace,
        {
          prompt: [{ role: "user", content: [{ type: "text", text: secret }] }],
        },
        { kind: "model", provider: "openai/gpt-4o" },
        { workflowId: "p2" },
      ),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });
});
