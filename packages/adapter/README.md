# @tailrace/adapter

Shared Tailrace integration helpers: tool execute wrapping and governed invocation. No host framework peers.

## Install

```bash
pnpm add @tailrace/adapter @tailrace/core
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { wrapToolExecute, runGoverned } from "@tailrace/adapter";

const tailrace = createTailrace();

const execute = wrapToolExecute(
  tailrace,
  "crm",
  async (args) => {
    /* call CRM */
    return args;
  },
  { agent: "support" },
);

await execute({ email: "user@example.com" });
```

Host packages (`@tailrace/openai-agents`, `@tailrace/ai-sdk`) consume this package. Prefer those for framework-specific APIs.
