# @tailrace/core

Detection, policy engine, vault, and audit for [Tailrace](../../README.md). Zero runtime
dependencies; runs on Node 20+, Cloudflare Workers, and Vercel Edge (WebCrypto only, no `node:`
imports).

## Public API

`createTailrace`, `definePolicy`, `defineRecognizer`, `memoryVault`, `kvVault`, `staticPolicy`, the
error classes (`TailraceError` and subclasses), and all public types. Everything else is internal.

```ts
import { createTailrace } from "@tailrace/core";

const tailrace = createTailrace(); // secrets blocked, common PII tokenized
const { output, decisions } = await tailrace.check(input, {
  boundary: { kind: "model", provider: "openai/gpt-4o" },
  identity: { agent: "default" },
  workflowId: "session-1",
});
```

Zero required config: `createTailrace()` enforces the default policy (secret classes → `block`,
common structured PII → `tokenize`). Pass `definePolicy(...)` / `staticPolicy(...)` to customize.

Integrations (`@tailrace/ai-sdk`, `@tailrace/mcp`, `@tailrace/hono`, `@tailrace/cli`) construct a
`Boundary` / `Identity`, call `check` / `restore`, and translate `PolicyViolationError` into the
host failure mode. They contain zero policy logic.
