# Block secrets in an Encore service

User-facing companion to [`integrations.md`](../integrations.md) §13. DevSite:
[Block secrets in an Encore service](https://tailrace.dev/docs/guides/block-secrets-in-encore) ·
[Encore integration](https://tailrace.dev/docs/integrations/encore).

## Overview

`@tailrace/encore` returns an Encore `middleware(...)` targeting **raw** openai-compat proxy
endpoints so request/response bodies and SSE are available.

## Installation

```bash
pnpm add @tailrace/core @tailrace/encore encore.dev
```

## Minimal service

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceEncore } from "@tailrace/encore";
import { Service } from "encore.dev/service";

export default new Service("api", {
  middlewares: [tailraceEncore(createTailrace(), { agent: "api" })],
});
```

Define the chat proxy with `api.raw` so Tailrace can read/write bodies. Same 422 / SSE contract
as Hono. See [`integrations.md`](../integrations.md) §13.
