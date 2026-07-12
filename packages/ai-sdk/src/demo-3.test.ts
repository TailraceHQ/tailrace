/**
 * Demo 3 regression: token stability across 50 steps via wrapModel + wrapTools.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import { tool, type ToolSet } from "ai";
import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { z } from "zod";

import { wrapModel } from "./wrap-model";
import { wrapTools } from "./wrap-tools";

const EMAIL = "stable50@example.com";

function mockEchoModel(): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId: "echo",
    supportedUrls: {},
    async doGenerate(options) {
      const msg = options.prompt[0];
      let text = "";
      if (msg?.role === "user" && msg.content[0]?.type === "text") {
        text = msg.content[0].text;
      }
      return {
        content: [{ type: "text", text }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    async doStream() {
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(c) {
          c.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          });
          c.close();
        },
      });
      return { stream };
    },
  };
}

describe("Demo 3 — token stability across 50 steps (wrappers)", () => {
  it("identical token via wrapModel transformParams, wrapTools out, and mixed boundaries", async () => {
    const vault = memoryVault({ key: "demo3-key" });
    const tailrace = createTailrace({ vault });
    const workflowId = "demo3-loop";
    const tokens: string[] = [];

    const model = wrapModel(tailrace, mockEchoModel(), { workflowId });
    const tools = wrapTools(
      tailrace,
      {
        crm: tool({
          description: "crm",
          inputSchema: z.object({ email: z.string() }),
          execute: async (args) => ({ email: args.email }),
        }),
      } satisfies ToolSet,
      { workflowId },
    );

    for (let step = 0; step < 50; step++) {
      let token = "";
      if (step === 0 || step === 16 || step === 41) {
        // Steps 1, 17, 42 (1-based) → 0, 16, 41 (0-based): different boundaries.
        if (step === 0) {
          const result = await model.doGenerate({
            prompt: [
              {
                role: "user",
                content: [{ type: "text", text: `customer ${EMAIL}` }],
              },
            ],
          });
          const text = result.content
            .filter((c) => c.type === "text")
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("");
          // transformParams tokenized the prompt; echo model returned tokenized text;
          // wrapGenerate may tokenize again (already tokens → unchanged).
          const match = text.match(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
          expect(match).not.toBeNull();
          token = match![0]!;
        } else if (step === 16) {
          const result = await tools.crm.execute!(
            { email: EMAIL },
            {
              toolCallId: "c",
              messages: [],
            },
          );
          const match = String((result as { email: string }).email).match(
            /<[A-Z0-9_]+_[a-z0-9]{8}>/,
          );
          expect(match).not.toBeNull();
          token = match![0]!;
        } else {
          // Mixed: tool out then model
          const toolResult = await tools.crm.execute!(
            { email: EMAIL },
            {
              toolCallId: "c",
              messages: [],
            },
          );
          const fromTool = String((toolResult as { email: string }).email);
          const result = await model.doGenerate({
            prompt: [
              {
                role: "user",
                content: [{ type: "text", text: `again ${EMAIL}` }],
              },
            ],
          });
          const text = result.content
            .filter((c) => c.type === "text")
            .map((c) => (c.type === "text" ? c.text : ""))
            .join("");
          const match = text.match(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
          expect(match).not.toBeNull();
          expect(fromTool).toContain(match![0]!);
          token = match![0]!;
        }
      } else {
        const { output } = await tailrace.check(`customer ${EMAIL}`, {
          boundary:
            step % 2 === 0
              ? { kind: "model", provider: "mock/echo" }
              : { kind: "tool", name: "crm", direction: "out" },
          identity: { agent: "default" },
          workflowId,
        });
        const match = String(output).match(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
        expect(match).not.toBeNull();
        token = match![0]!;
      }
      tokens.push(token);
    }

    expect(new Set(tokens).size).toBe(1);

    const restored = await tailrace.restore(`done ${tokens[0]}`, {
      boundary: { kind: "egress", sink: "ui" },
      identity: { agent: "default" },
      workflowId,
    });
    expect(restored.output).toBe(`done ${EMAIL}`);
  });
});
