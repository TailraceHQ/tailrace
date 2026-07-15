# @tailrace/core

Detection, policy engine, vault, and audit for [Tailrace](../../README.md). Zero runtime
dependencies; runs on Node 20+, Cloudflare Workers, and Vercel Edge (WebCrypto only, no `node:`
imports).

## Public API

`createTailrace`, `definePolicy`, `defineRecognizer`, `definePatternRecognizer`, `memoryVault`, `kvVault`, `staticPolicy`, the
error classes (`TailraceError` and subclasses), and all public types. Everything else is internal.

```ts
import { createTailrace, definePatternRecognizer, definePolicy } from "@tailrace/core";

const employeeId = definePatternRecognizer({
  id: "employee-id",
  entity: "employee_id",
  tier: 0,
  patterns: [{ source: String.raw`\bEMP-\d{5}\b`, confidence: 1 }],
});

const tailrace = createTailrace({
  recognizers: [employeeId],
  policy: definePolicy({
    entities: { employee_id: "tokenize" },
    defaults: { action: "allow" },
  }),
});

const { output, decisions } = await tailrace.check("Assign EMP-01234", {
  boundary: { kind: "model", provider: "openai/gpt-4o" },
  identity: { agent: "default" },
  workflowId: "session-1",
});
```

Zero required config: `createTailrace()` without custom recognizers enforces the default policy (secret classes → `block`,
common structured PII → `tokenize`). Pass `definePolicy(...)` / `staticPolicy(...)` to customize.

Integrations (`@tailrace/ai-sdk`, `@tailrace/mcp`, `@tailrace/hono`, `@tailrace/cli`) construct a
`Boundary` / `Identity`, call `check` / `restore`, and translate `PolicyViolationError` into the
host failure mode. They contain zero policy logic.
