# Guide: Cloudflare Agents integration

User-facing companion to [`integrations.md`](../integrations.md) §8. Acceptance: [`milestones.md`](../milestones.md) §M7c.

## Compose model

`@tailrace/cloudflare-agents` depends on `@tailrace/ai-sdk` for `wrapModel` / `wrapTools` / streaming. You do not reimplement carry-buffer or `streamBlockBehavior`.

## Install

```bash
pnpm add @tailrace/cloudflare-agents @tailrace/core ai
```

## Wire a chat agent

```ts
import { createCloudflareTailrace, withCloudflareAgents } from "@tailrace/cloudflare-agents";
import { streamText, convertToModelMessages } from "ai";

// Inside AIChatAgent / Durable Object:
const tr = createCloudflareTailrace(this.env, {
  agent: this.name,
  workflowId: this.name,
  kv: this.env.TAILRACE_VAULT,
  vaultKey: this.env.TAILRACE_VAULT_KEY,
});

const { model, tools } = withCloudflareAgents(tr, {
  agent: this.name,
  workflowId: this.name,
}).forChat({
  model: baseModel,
  tools: { crm: crmTool },
  streamBlockBehavior: "abort",
});

async onChatMessage() {
  const result = streamText({
    model,
    messages: await convertToModelMessages(this.messages),
    tools,
  });
  return result.toUIMessageStreamResponse();
}
```

## Client tools (`onToolCall`)

```ts
const api = withCloudflareAgents(tr, { agent: this.name, workflowId: this.name });
const onToolCall = api.wrapOnToolCall(async ({ toolCall, addToolOutput }) => {
  // toolCall.args already checked (direction out)
  const result = await runClientTool(toolCall);
  await addToolOutput({ toolCallId: toolCall.toolCallId, output: result });
});
```

## Peers / versions

- Required peer: `ai@^5` (same as `@tailrace/ai-sdk`).
- Optional peer: `agents` (Cloudflare Agents host) for version alignment.
- `@cloudflare/ai-chat` may peer `ai@^6`; Tailrace Compose currently targets AI SDK v5 middleware. Prefer an `ai@5` stack with `@tailrace/ai-sdk`, or wait for a future ai-sdk bump.
