# @tailrace/openai-agents

Govern OpenAI Agents SDK function tools with Tailrace. Args and results pass through `check` at the tool boundary.

## Install

```bash
pnpm add @tailrace/openai-agents @tailrace/core @openai/agents
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { wrapTools } from "@tailrace/openai-agents";
import { Agent, tool } from "@openai/agents";
import { z } from "zod";

const crm = tool({
  name: "crm",
  description: "Lookup customer",
  parameters: z.object({ email: z.string() }),
  execute: async ({ email }) => ({ email }),
});

const tools = wrapTools(createTailrace(), [crm], { agent: "support" });
const agent = new Agent({ name: "Support", tools });
```

## Notes

- Function tools only (`type: "function"`). Hosted tools (web search, file search, etc.) are out of scope.
- Model/prompt scanning is not wrapped in this package; use tool wraps + SDK input guardrails.
- Bound against `@openai/agents@0.3.x` (`FunctionTool.invoke`).
