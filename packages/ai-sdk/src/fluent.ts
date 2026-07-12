/**
 * Fluent AI SDK helpers without core importing `ai` (docs/integrations.md §1).
 */

import type { Tailrace } from "@tailrace/core";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { ToolSet } from "ai";

import type { AiSdkWrapOptions, TailraceWithAiSdk } from "./types";
import { wrapModel } from "./wrap-model";
import { wrapTools } from "./wrap-tools";

/**
 * Attach `model` / `tools` helpers to an existing Tailrace instance.
 *
 * @example
 * ```ts
 * const tailrace = withAiSdk(createTailrace());
 * const model = tailrace.model(openai("gpt-4o"));
 * ```
 */
export function withAiSdk(tailrace: Tailrace): TailraceWithAiSdk {
  return Object.assign(tailrace, {
    model: (model: LanguageModelV2, opts?: AiSdkWrapOptions) => wrapModel(tailrace, model, opts),
    tools: <T extends ToolSet>(tools: T, opts?: AiSdkWrapOptions) =>
      wrapTools(tailrace, tools, opts),
  });
}
