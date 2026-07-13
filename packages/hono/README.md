# @tailrace/hono

Policy enforcement for [Hono](https://hono.dev) (`hono` `>=4`). OpenAI-compatible passthrough:
parses chat request bodies, applies policy at the model boundary, and scans JSON + SSE responses.

A block returns **422** with `{ error: { type: "policy_violation", entity, rule } }`. SSE blocks
cancel upstream and emit one error `data:` event (abort-only in v0.1).

## Install

```bash
pnpm add @tailrace/core @tailrace/hono hono
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceHono } from "@tailrace/hono";
import { Hono } from "hono";

const app = new Hono();
const tailrace = createTailrace();
app.use(
  "/v1/*",
  tailraceHono(tailrace, {
    agent: (c) => c.req.header("x-agent-id") ?? "default",
  }),
);
```

## Options

| Option       | Default               | Notes                       |
| ------------ | --------------------- | --------------------------- |
| `mode`       | `"openai-compatible"` | Only mode in v0.1           |
| `agent`      | `"default"`           | `(c) => string`             |
| `workflowId` | `"default"`           | `string` or `(c) => string` |
| `onDecision` | -                     | Forwarded audit callback    |

Boundary: `{ kind: "model", provider }` where `provider` is the request body's `model` string as-is.
Spec: [`docs/integrations.md`](../../docs/integrations.md) §3.
Guide: [`docs/guides/hono-integration.md`](../../docs/guides/hono-integration.md).
