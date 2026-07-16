/**
 * @tailrace/cloudflare-agents — Cloudflare Agents Compose helpers (docs/integrations.md §8).
 *
 * Depends on `@tailrace/ai-sdk` for wrapModel / wrapTools / streaming (no local reimplementation).
 * Peers: `ai@^5` (required); `agents` optional for host alignment.
 * Bound at M7c: ai@5.x; Cloudflare Agents (`agents` / `@cloudflare/ai-chat`) commonly peer ai@6 —
 * use forChat with LanguageModelV2-compatible models from the AI SDK version you install with
 * @tailrace/ai-sdk. Record drift in integrations.md when upgrading.
 */

export type {
  AddToolOutput,
  ClientToolCall,
  CloudflareAgentsApi,
  CloudflareChatWrapOptions,
  CloudflareChatWrapped,
  CloudflareTailraceOptions,
  OnToolCallHandler,
  StreamBlockBehavior,
} from "./types";
export { createCloudflareTailrace, resolveCfAgent, resolveCfWorkflowId } from "./create";
export { withCloudflareAgents } from "./fluent";
