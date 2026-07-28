# Guide: Vercel Eve integration

User-facing companion to [`integrations.md`](../integrations.md) §15. Acceptance: [`milestones.md`](../milestones.md) §M10.

## Install

```bash
pnpm add @tailrace/eve @tailrace/core eve
```

## Wrap a tool

Eve derives the runtime tool name from the filename under `agent/tools/`. Pass that same name to
`governTool` so policy keys like `tool:crm` stay predictable.

```ts
// agent/tools/crm.ts
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
  { agent: "support" },
);
```

Fluent form:

```ts
import { withEve } from "@tailrace/eve";

const t = withEve(createTailrace());
export default t.tool("crm", defineTool({ ... }), { agent: "support" });
```

## Boundaries

| Direction | Boundary |
|---|---|
| Tool args | `{ kind: "tool", name, direction: "out" }` |
| Tool result | `{ kind: "tool", name, direction: "in" }` |

On `block`, the wrapper throws an `Error` with a value-free message so Eve can surface it to the
model for self-correction.

## Workflow id / token stability

By default Tailrace uses Eve's durable session id (`ctx.session.id`) as `workflowId`, so tokens
stay stable across Workflow replay. Override with `workflowId` when you need a different scope.

## Model boundary

Eve's `defineAgent({ model })` accepts a gateway string or an AI SDK `LanguageModel`. For
prompt/completion scanning, wrap with `@tailrace/ai-sdk` `wrapModel` and pass the result into
`defineAgent`.

## Limitations

- Tool-boundary governance only in `@tailrace/eve` itself.
- Framework sandbox tools (`bash`, `read_file`, …) are only governed if you route them through
  `governTool`.
- Channel egress restore, subagents, skills, connections, and OTel enforcement are out of scope.
