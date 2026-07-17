/**
 * Mock LanguageModelV2 that echoes the last user text part.
 * Used when OPENAI_API_KEY is absent (no network).
 */

import type { LanguageModelV2, LanguageModelV2StreamPart } from "@ai-sdk/provider";

export function createEchoModel(): LanguageModelV2 {
  return {
    specificationVersion: "v2",
    provider: "mock",
    modelId: "echo",
    supportedUrls: {},
    async doGenerate(options) {
      let text = "";
      for (const msg of options.prompt) {
        if (msg.role === "user") {
          for (const part of msg.content) {
            if (part.type === "text") text = part.text;
          }
        }
      }
      return {
        content: [{ type: "text", text: text || "(empty)" }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    async doStream(options) {
      let text = "";
      for (const msg of options.prompt) {
        if (msg.role === "user") {
          for (const part of msg.content) {
            if (part.type === "text") text = part.text;
          }
        }
      }
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "t1" });
          controller.enqueue({ type: "text-delta", id: "t1", delta: text || "(empty)" });
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      });
      return { stream };
    },
  };
}
