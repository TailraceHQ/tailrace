# @tailrace/core

Detection, policy engine, vault, and audit for [Tailrace](../../README.md). Zero runtime
dependencies; runs on Node 20+, Cloudflare Workers, and Vercel Edge (WebCrypto only, no `node:`
imports).

> **M0 skeleton.** The public type surface is complete and stable; runtime factories throw
> `NotImplementedError` until their milestone lands (see [`docs/milestones.md`](../../docs/milestones.md)).

## Public API

`createTailrace`, `definePolicy`, `defineRecognizer`, `memoryVault`, `kvVault`, `staticPolicy`, the
error classes (`TailraceError` and subclasses), and all public types. Everything else is internal.

```ts
import { createTailrace } from "@tailrace/core";

const tailrace = createTailrace(); // secrets blocked, common PII tokenized
const { output, decisions } = await tailrace.check(input, {
  boundary: { kind: "model", provider: "openai/gpt-4o" },
  identity: { agent: "default" },
});
```
