> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/trpc

Policy enforcement for [tRPC](https://trpc.io) (`@trpc/server` `>=10`). Procedure middleware
scans input/output at the **tool** boundary (not an OpenAI REST gateway).

## Install

```bash
pnpm add @tailrace/core @tailrace/trpc @trpc/server
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { createTailraceMiddleware } from "@tailrace/trpc";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();
const governed = createTailraceMiddleware(createTailrace(), { agent: "api" });
export const procedure = t.procedure.use(governed);
```

Non-streaming queries/mutations only in v0.1. Spec: [`docs/integrations.md`](../../docs/integrations.md) §14.
