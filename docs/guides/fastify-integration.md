# Block secrets in a Fastify app

User-facing companion to [`integrations.md`](../integrations.md) §11. DevSite:
[Block secrets in a Fastify app](https://tailrace.dev/docs/guides/block-secrets-in-fastify) ·
[Fastify integration](https://tailrace.dev/docs/integrations/fastify).

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
await app.register(
  tailraceFastify(createTailrace(), {
    agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
    workflowId: (req) => String(req.headers["x-workflow-id"] ?? "default"),
  }),
);
```

See [`integrations.md`](../integrations.md) §3 / §11 for the full 422 / SSE contract. For Nest +
Fastify, register this plugin on the underlying Fastify instance (see
[nestjs-integration.md](nestjs-integration.md)).
