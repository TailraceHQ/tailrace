# Guide: Ship an agent on Vercel (AI SDK)

User-facing companion to [`integrations.md`](../integrations.md) §1. Site guide: [`ship-an-agent-on-vercel.mdx`](../../apps/web/content/docs/guides/ship-an-agent-on-vercel.mdx). For acceptance criteria see [`milestones.md`](../milestones.md) §M3.

## Overview

`@tailrace/ai-sdk` sits between your application and the Vercel AI SDK. It does not implement policy rules - it constructs the correct `Boundary` and `Identity`, calls `tailrace.check` / `tailrace.restore`, and translates failures into forms the AI SDK understands.

```
Your route → wrapModel / wrapTools → tailrace.check → provider / tool
                                              ↓
                                         audit emit
```

## Installation

```bash
pnpm add @tailrace/core @tailrace/ai-sdk ai @ai-sdk/openai
```

Peer: `ai@^5`.

## Minimal route (Next.js App Router)

```ts
import { createTailrace, PolicyViolationError } from "@tailrace/core";
import { withAiSdk } from "@tailrace/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const tailrace = withAiSdk(createTailrace());

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const workflowId = req.headers.get("x-workflow-id") ?? crypto.randomUUID();

  const model = tailrace.model(openai("gpt-4o"), { workflowId, agent: "chat" });

  try {
    const result = await generateText({ model, prompt });
    const restored = await tailrace.restore(result.text, {
      boundary: { kind: "egress", sink: "ui" },
      identity: { agent: "chat" },
      workflowId,
    });
    return Response.json({ text: restored.output });
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      return Response.json({ error: { type: "policy_violation", message: err.message } }, { status: 422 });
    }
    throw err;
  }
}
```

## Workflow IDs

Tokens are deterministic per `(workflowId, entityClass, normalizedValue)`. Pass the same `workflowId` to `model`, `tools`, and `restore` within a conversation or agent run so repeated PII gets the same token.

Sources that work well:

- Chat session ID
- Request header (`x-workflow-id`)
- Clerk / Auth session subject + thread ID

If omitted, Tailrace uses `"default"`.

## Policy targeting by provider

Model boundaries use encoded provider strings. Policy keys are bare globs in the model namespace:

```ts
definePolicy({
  boundaries: {
    "openai/*": { entities: { email: "tokenize" } },
    "anthropic/*": { entities: { email: "allow" } },
  },
});
```

Exact keys beat globs: `openai/gpt-4o` wins over `openai/*`.

## Streaming

Default `streamBlockBehavior: "abort"` is fail-closed. Use `redact` only when you explicitly prefer masked placeholders over cancelling the stream.

See [`integrations.md`](../integrations.md) §1.4 for mode semantics.

## Demos

| Demo | Location | Command |
| --- | --- | --- |
| Block secret + tokenize email | `examples/nextjs-ai-sdk` | `pnpm --filter example-nextjs-ai-sdk dev` |
| Token stability (50 steps) | same | `pnpm --filter example-nextjs-ai-sdk demo:3` |
