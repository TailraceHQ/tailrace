/**
 * Public types for @tailrace/cloudflare-agents.
 */

import type { AiSdkWrapOptions, StreamBlockBehavior } from "@tailrace/ai-sdk";
import type { Decision, KvStore, Tailrace, TailraceOptions } from "@tailrace/core";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { ToolSet } from "ai";

export type { StreamBlockBehavior };

export interface CloudflareTailraceOptions {
  /** Agent identity. Defaults to `"default"`. Prefer Durable Object / agent instance name. */
  agent?: string;
  /** Workflow scope for tokens. Defaults to `agent` when set, else `"default"`. */
  workflowId?: string | (() => string);
  /** Cloudflare KV (or compatible). When set, uses kvVault; otherwise memoryVault. */
  kv?: KvStore;
  /** Forwarded to createTailrace (policy, audit, vault key via memory options, etc.). */
  createOptions?: Omit<TailraceOptions, "vault">;
  /** Vault master key when using kv or memory. */
  vaultKey?: string;
  onDecision?: (decisions: Decision[]) => void;
}

export interface CloudflareChatWrapOptions extends AiSdkWrapOptions {
  model: LanguageModelV2;
  tools?: ToolSet;
}

export interface CloudflareChatWrapped {
  model: LanguageModelV2;
  tools: ToolSet;
}

/** Structural client tool call (useAgentChat onToolCall). */
export interface ClientToolCall {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  input?: unknown;
}

export type AddToolOutput = (opts: { toolCallId: string; output: unknown }) => void | Promise<void>;

export type OnToolCallHandler = (opts: {
  toolCall: ClientToolCall;
  addToolOutput: AddToolOutput;
}) => void | Promise<void>;

export interface CloudflareAgentsApi {
  forChat(opts: CloudflareChatWrapOptions): CloudflareChatWrapped;
  wrapOnToolCall(handler: OnToolCallHandler, opts?: AiSdkWrapOptions): OnToolCallHandler;
  readonly tailrace: Tailrace;
  readonly agent: string;
  readonly resolveWorkflowId: () => string;
}
