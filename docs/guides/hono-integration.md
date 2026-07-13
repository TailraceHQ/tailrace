# Guide: Hono OpenAI-compatible middleware

User-facing companion to [`integrations.md`](../integrations.md) §3. For acceptance criteria see [`milestones.md`](../milestones.md) §M5.

## Overview

`@tailrace/hono` sits on OpenAI-format chat routes. It scans request message text before upstream, then scans JSON completions and SSE streams on the way back. Block → **422** (SSE: abort-equivalent error event).

```
Client → tailraceHono → check (model) → upstream
                ↑              ↓
           response ← check ← body / SSE
```

## Installation

```bash
pnpm add @tailrace/core @tailrace/hono hono
```

Peer: `hono` `>=4`.

## Minimal middleware

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceHono } from "@tailrace/hono";
import { Hono } from "hono";

const app = new Hono();
const tailrace = createTailrace();

app.use(
  "/v1/*",
  tailraceHono(tailrace, {
    mode: "openai-compatible",
    agent: (c) => c.req.header("x-agent-id") ?? "default",
    workflowId: (c) => c.req.header("x-workflow-id") ?? "default",
  }),
);
```

## Boundary encoding

`{ kind: "model", provider }` where `provider` is the request body's `model` string **as-is** (for example `gpt-4o` or `openai/gpt-4o`). Match policy globs to that string.

## SSE

Carry-buffer is implemented locally in `@tailrace/hono` (does not import `@tailrace/ai-sdk`). v0.1 has no `streamBlockBehavior` - SSE block cancels upstream and emits one error `data:` event.

See [`integrations.md`](../integrations.md) §3 for the full 422 / SSE contract.
