/**
 * Demo 3 — token stability across 50 steps (docs/milestones.md).
 *
 * Run: pnpm --filter example-nextjs-ai-sdk demo:3
 */

import { createTailrace, memoryVault } from "@tailrace/core";
import { wrapModel, wrapTools } from "@tailrace/ai-sdk";
import { tool, type ToolSet } from "ai";
import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";
import { z } from "zod";

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

async function main(): Promise<void> {
  const vault = memoryVault({ key: "demo3-example" });
  const tailrace = createTailrace({ vault });
  const workflowId = "demo3-example-loop";
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
    if (step === 0) {
      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: `customer ${EMAIL}` }] }],
      });
      const text = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("");
      token = text.match(/<[A-Z0-9_]+_[a-z0-9]{8}>/)?.[0] ?? "";
    } else if (step === 16) {
      const result = await tools.crm.execute!({ email: EMAIL }, { toolCallId: "c", messages: [] });
      token =
        String((result as { email: string }).email).match(/<[A-Z0-9_]+_[a-z0-9]{8}>/)?.[0] ?? "";
    } else if (step === 41) {
      const toolResult = await tools.crm.execute!(
        { email: EMAIL },
        { toolCallId: "c", messages: [] },
      );
      const fromTool = String((toolResult as { email: string }).email);
      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: `again ${EMAIL}` }] }],
      });
      const text = result.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("");
      token = text.match(/<[A-Z0-9_]+_[a-z0-9]{8}>/)?.[0] ?? "";
      if (!fromTool.includes(token)) {
        throw new Error("tool and model tokens diverged at step 42");
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
      token = String(output).match(/<[A-Z0-9_]+_[a-z0-9]{8}>/)?.[0] ?? "";
    }
    if (!token) throw new Error(`no token at step ${step + 1}`);
    tokens.push(token);
  }

  if (new Set(tokens).size !== 1) {
    throw new Error(`expected 1 unique token, got ${new Set(tokens).size}`);
  }

  const restored = await tailrace.restore(`done ${tokens[0]}`, {
    boundary: { kind: "egress", sink: "ui" },
    identity: { agent: "default" },
    workflowId,
  });
  if (restored.output !== `done ${EMAIL}`) {
    throw new Error("egress restore failed");
  }

  console.log("Demo 3 OK — identical token across 50 steps; egress restored.");
  console.log("token:", tokens[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
