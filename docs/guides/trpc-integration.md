# Govern tRPC procedures

User-facing companion to [`integrations.md`](../integrations.md) §14. DevSite:
[Govern tRPC procedures](https://tailrace.dev/docs/guides/govern-trpc-procedures) ·
[tRPC integration](https://tailrace.dev/docs/integrations/trpc).

## Overview

`@tailrace/trpc` is **procedure middleware**, not an OpenAI REST gateway. It checks procedure
`input` at `{ kind: "tool", name, direction: "out" }` and result data at `direction: "in"`.
Block → `TRPCError` (`BAD_REQUEST`) with a value-free message.

## Installation

```bash
pnpm add @tailrace/core @tailrace/trpc @trpc/server
```

## Minimal procedure

```ts
import { createTailrace } from "@tailrace/core";
import { createTailraceMiddleware, withTrpc } from "@tailrace/trpc";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();
const governed = createTailraceMiddleware(createTailrace(), {
  agent: "api",
  name: ({ path }) => path,
});
export const procedure = t.procedure.use(governed);

// Fluent
const tr = withTrpc(createTailrace());
export const procedure2 = t.procedure.use(tr.middleware({ agent: "api" }));
```

v0.1 supports non-streaming queries/mutations only. See [`integrations.md`](../integrations.md) §14.
