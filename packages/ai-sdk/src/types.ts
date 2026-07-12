/**
 * Public types for @tailrace/ai-sdk.
 */

import type { Decision, Tailrace } from "@tailrace/core";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { ToolSet } from "ai";

/**
 * How wrapStream translates a policy `block` at the streaming surface
 * (docs/integrations.md §1.4). Non-streaming wrapGenerate always throws.
 */
export type StreamBlockBehavior = "abort" | "buffer" | "redact";

export interface AiSdkWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  /** Output streaming only. Default: `"abort"` (fail-closed). */
  streamBlockBehavior?: StreamBlockBehavior;
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Tailrace instance with fluent AI SDK helpers. Produced by {@link withAiSdk};
 * core stays framework-free.
 */
export interface TailraceWithAiSdk extends Tailrace {
  model(model: LanguageModelV2, opts?: AiSdkWrapOptions): LanguageModelV2;
  tools<T extends ToolSet>(tools: T, opts?: AiSdkWrapOptions): T;
}
