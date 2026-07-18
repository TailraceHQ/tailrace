> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/encore

Policy enforcement for [Encore.ts](https://encore.dev) (`encore.dev`). OpenAI-compatible
passthrough for **raw** proxy endpoints at the model boundary (422 / SSE abort).

## Install

```bash
pnpm add @tailrace/core @tailrace/encore encore.dev
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { tailraceEncore } from "@tailrace/encore";
import { Service } from "encore.dev/service";

export default new Service("api", {
  middlewares: [tailraceEncore(createTailrace(), { agent: "api" })],
});
```

Use `api.raw` for openai-compat proxies so bodies and SSE are available.
Spec: [`docs/integrations.md`](../../docs/integrations.md) §13.
