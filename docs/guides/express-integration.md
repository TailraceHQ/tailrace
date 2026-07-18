# Guide: Express OpenAI-compatible middleware

User-facing companion to [`integrations.md`](../integrations.md) §10. Plan: [`m9-plan.md`](../m9-plan.md).

## Overview

`@tailrace/express` sits on OpenAI-format chat routes. Same contract as Hono: request scan →
upstream → JSON / SSE response scan. Block → **422** (SSE: abort-equivalent error event).

## Installation

```bash
pnpm add @tailrace/core @tailrace/express express
```

## Minimal middleware

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceExpress } from "@tailrace/express";
import express from "express";

const app = express();
app.use("/v1", express.json(), tailraceExpress(createTailrace(), {
  agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
}));
```

See [`integrations.md`](../integrations.md) §3 / §10 for the full 422 / SSE contract.
