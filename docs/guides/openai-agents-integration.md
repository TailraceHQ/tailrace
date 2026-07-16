# Guide: OpenAI Agents SDK integration

User-facing companion to [`integrations.md`](../integrations.md) §7. Acceptance: [`milestones.md`](../milestones.md) §M7b.

## Install

```bash
pnpm add @tailrace/openai-agents @tailrace/core @openai/agents
```

## Wrap function tools

```ts
import { createTailrace } from "@tailrace/core";
import { wrapTools, withOpenAiAgents } from "@tailrace/openai-agents";
import { Agent, tool } from "@openai/agents";
import { z } from "zod";

const crm = tool({
  name: "crm",
  description: "Lookup customer",
  parameters: z.object({ email: z.string() }),
  execute: async ({ email }) => ({ email }),
});

const tools = wrapTools(createTailrace(), [crm], {
  agent: "support",
  workflowId: "wf-1",
});

// or fluent
const t = withOpenAiAgents(createTailrace());
const tools2 = t.tools([crm], { agent: "support" });

const agent = new Agent({ name: "Support", tools });
```

## Boundaries

| Direction | Boundary |
|---|---|
| Tool args | `{ kind: "tool", name, direction: "out" }` |
| Tool result | `{ kind: "tool", name, direction: "in" }` |

On `block`, the wrapper throws an `Error` with a value-free message so the model can self-correct.

## Limitations

- **Hosted tools** (web search, file search, code interpreter, etc.) run off-process and are not wrapped.
- **Model / prompt scanning** is out of scope for M7; combine tool wraps with SDK input guardrails if needed.
