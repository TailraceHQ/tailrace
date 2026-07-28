> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/eve

Govern Vercel Eve `defineTool` execute with Tailrace. Args and results pass through `check` at the tool boundary.

## Install

```bash
pnpm add @tailrace/eve @tailrace/core eve
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { governTool } from "@tailrace/eve";
import { defineTool } from "eve/tools";
import { z } from "zod";

const tailrace = createTailrace();

export default governTool(
  tailrace,
  "crm",
  defineTool({
    description: "Look up a customer in the CRM.",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => crm.search(query),
  }),
);
```

## Notes

- Pass `name` equal to the filename under `agent/tools/` so policy keys like `tool:crm` stay predictable.
- Default `workflowId` is Eve's durable `ctx.session.id` (token-stable across Workflow replay).
- Model-boundary scanning: Eve accepts an AI SDK `LanguageModel` in `defineAgent({ model })` - use `@tailrace/ai-sdk` `wrapModel` when you need prompt/completion governance.
- Framework sandbox tools (`bash`, `read_file`, …) are only governed if you route them through `governTool`.
