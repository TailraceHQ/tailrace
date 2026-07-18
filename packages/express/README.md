> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/express

Policy enforcement for [Express](https://expressjs.com) (`express` `>=4`). OpenAI-compatible
passthrough at the model boundary (422 / SSE abort). Same contract as `@tailrace/hono`.

## Install

```bash
pnpm add @tailrace/core @tailrace/express express
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceExpress } from "@tailrace/express";
import express from "express";

const app = express();
const tailrace = createTailrace();
app.use(
  "/v1",
  express.json(),
  tailraceExpress(tailrace, {
    agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
  }),
);
```

Spec: [`docs/integrations.md`](../../docs/integrations.md) §10.
