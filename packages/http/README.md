> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/http

Shared OpenAI-compatible HTTP pipeline: chat body helpers, SSE carry-buffer, and 422 policy
violation bodies. No host framework peers. Used by `@tailrace/hono`, `@tailrace/express`, and
other gateway packages.

## Install

```bash
pnpm add @tailrace/core @tailrace/http
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { runOpenAiCompatRequestCheck, POLICY_VIOLATION_STATUS } from "@tailrace/http";

const tailrace = createTailrace();
const body = await runOpenAiCompatRequestCheck(tailrace, chatBody, { agent: "api" });
```

Prefer a host package (`@tailrace/hono`, `@tailrace/express`, …) unless you are building a custom
adapter. Spec: [`docs/integrations.md`](../../docs/integrations.md) §9.
