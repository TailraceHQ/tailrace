/**
 * wrapModel — AI SDK LanguageModelV2 middleware (docs/integrations.md §1.2).
 */

import type { Tailrace } from "@tailrace/core";
import type { LanguageModelV2, LanguageModelV2Middleware } from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

import { checkWithOpts } from "./internal/context";
import { applyGenerateText, checkPromptParams, extractGenerateText } from "./internal/messages";
import { encodeModelProvider } from "./internal/provider";
import { createStreamTransform } from "./stream";
import type { AiSdkWrapOptions } from "./types";

function modelBoundary(model: LanguageModelV2) {
  return { kind: "model" as const, provider: encodeModelProvider(model) };
}

function createMiddleware(tailrace: Tailrace, opts?: AiSdkWrapOptions): LanguageModelV2Middleware {
  return {
    middlewareVersion: "v2",

    async transformParams({ params, model }) {
      const boundary = modelBoundary(model);
      const { params: next } = await checkPromptParams(tailrace, params, boundary, opts);
      return next;
    },

    async wrapGenerate({ doGenerate, model }) {
      const result = await doGenerate();
      const boundary = modelBoundary(model);
      const text = extractGenerateText(result.content);
      if (text.length === 0) return result;
      const { output } = await checkWithOpts(tailrace, text, boundary, opts);
      return {
        ...result,
        content: applyGenerateText(result.content, output),
      };
    },

    async wrapStream({ doStream, model }) {
      const result = await doStream();
      const boundary = modelBoundary(model);
      const transform = createStreamTransform(tailrace, boundary, opts);
      return {
        ...result,
        stream: result.stream.pipeThrough(transform),
      };
    },
  };
}

/**
 * Wrap a language model so prompt messages (model boundary) and generated output
 * pass through Tailrace policy.
 *
 * @example
 * ```ts
 * const model = wrapModel(tailrace, openai("gpt-4o"), { agent: "support" });
 * ```
 */
export function wrapModel(
  tailrace: Tailrace,
  model: LanguageModelV2,
  opts?: AiSdkWrapOptions,
): LanguageModelV2 {
  return wrapLanguageModel({
    model,
    middleware: createMiddleware(tailrace, opts),
  });
}
