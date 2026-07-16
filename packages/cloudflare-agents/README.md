# @tailrace/cloudflare-agents

Compose Tailrace with Cloudflare Agents / `AIChatAgent`: identity, vault, and AI SDK wraps in one entry point.

## Install

```bash
pnpm add @tailrace/cloudflare-agents @tailrace/core ai
```

## Quickstart

```ts
import { createCloudflareTailrace, withCloudflareAgents } from "@tailrace/cloudflare-agents";
import { streamText, convertToModelMessages } from "ai";

const tr = createCloudflareTailrace(env, {
  agent: this.name,
  workflowId: this.name,
  kv: env.TAILRACE_VAULT,
});

const { model, tools } = withCloudflareAgents(tr, {
  agent: this.name,
  workflowId: this.name,
}).forChat({ model: baseModel, tools: { crm: crmTool } });

const result = streamText({
  model,
  messages: await convertToModelMessages(this.messages),
  tools,
});
```

Uses `@tailrace/ai-sdk` for `wrapModel` / `wrapTools` / streaming (Compose). Peer `ai@^5` (same as `@tailrace/ai-sdk`).
