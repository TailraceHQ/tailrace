# Guide: Fastify OpenAI-compatible plugin

User-facing companion to [`integrations.md`](../integrations.md) §11. Plan: [`m9-plan.md`](../m9-plan.md).

## Overview

`@tailrace/fastify` registers as a Fastify plugin (`preHandler` + `onSend`). Same openai-compat
contract as Hono / Express.

## Installation

```bash
pnpm add @tailrace/core @tailrace/fastify fastify
```

## Minimal plugin

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceFastify } from "@tailrace/fastify";
import Fastify from "fastify";

const app = Fastify();
await app.register(tailraceFastify(createTailrace(), {
  agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
}));
```

See [`integrations.md`](../integrations.md) §3 / §11 for the full 422 / SSE contract.
