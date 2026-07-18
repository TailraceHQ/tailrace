> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/fastify

Policy enforcement for [Fastify](https://fastify.dev) (`fastify` `>=4`). OpenAI-compatible
passthrough at the model boundary (422 / SSE abort). Same contract as `@tailrace/hono`.

## Install

```bash
pnpm add @tailrace/core @tailrace/fastify fastify
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceFastify } from "@tailrace/fastify";
import Fastify from "fastify";

const app = Fastify();
const tailrace = createTailrace();
await app.register(
  tailraceFastify(tailrace, {
    agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
  }),
);
```

Spec: [`docs/integrations.md`](../../docs/integrations.md) §11.
