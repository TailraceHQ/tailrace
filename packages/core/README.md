<p align="center">
  <a href="https://tailrace.dev">
    <img src="https://tailrace.dev/link-preview.png" alt="Tailrace - Ship agents, not secrets" width="640" />
  </a>
</p>

# @tailrace/core

**Agent data governance for TypeScript.** In-process detection of secrets and PII, reversible
workflow-scoped tokenization, and per-agent data-flow policy enforced at the model, tool, and MCP
boundaries. No proxy, no sidecar, no network call in the request hot path.

This package is the foundation of [Tailrace](https://tailrace.dev). Every `@tailrace/*` integration
depends on it.

## Packages

| Package                       | npm                                                              | What it is                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@tailrace/core`              | [npm](https://www.npmjs.com/package/@tailrace/core)              | Detection, policy engine, vault, audit. Zero runtime deps; runs on Node, Cloudflare Workers, and Vercel Edge. |
| `@tailrace/adapter`           | [npm](https://www.npmjs.com/package/@tailrace/adapter)           | Shared integration helpers: `wrapToolExecute`, `runGoverned`. No host peers.                                  |
| `@tailrace/ai-sdk`            | [npm](https://www.npmjs.com/package/@tailrace/ai-sdk)            | Vercel AI SDK middleware + tool wrapper.                                                                      |
| `@tailrace/cloudflare-agents` | [npm](https://www.npmjs.com/package/@tailrace/cloudflare-agents) | Cloudflare Agents / `AIChatAgent` compose entry (identity, vault, AI SDK wraps).                              |
| `@tailrace/openai-agents`     | [npm](https://www.npmjs.com/package/@tailrace/openai-agents)     | OpenAI Agents SDK function tool wrappers.                                                                     |
| `@tailrace/mcp`               | [npm](https://www.npmjs.com/package/@tailrace/mcp)               | MCP client transport wrapper.                                                                                 |
| `@tailrace/hono`              | [npm](https://www.npmjs.com/package/@tailrace/hono)              | Hono middleware (OpenAI-compatible passthrough).                                                              |
| `@tailrace/cli`               | [npm](https://www.npmjs.com/package/@tailrace/cli)               | `tailrace` binary: `init`, `scan`, `install-hooks`, `hook`.                                                   |
| `@tailrace/recognizer-ner`    | [npm](https://www.npmjs.com/package/@tailrace/recognizer-ner)    | Optional Tier 1 ONNX NER (Privacy Filter; bring your own weights). Node only.                                 |

[All `@tailrace` packages on npm](https://www.npmjs.com/org/tailrace)

## Quickstart

```bash
pnpm add @tailrace/core @tailrace/ai-sdk ai @ai-sdk/openai
```

```ts
import { createTailrace } from "@tailrace/core";
import { withAiSdk } from "@tailrace/ai-sdk";
import { openai } from "@ai-sdk/openai";

const tailrace = withAiSdk(createTailrace()); // zero config: secrets blocked, common PII tokenized
const model = tailrace.model(openai("gpt-4o"));
// Use `model` anywhere you'd use the AI SDK model - sensitive values never leave the process.
```

Also see [`@tailrace/mcp`](https://www.npmjs.com/package/@tailrace/mcp) (`withMcp` / `wrapTransport`) and
[`@tailrace/hono`](https://www.npmjs.com/package/@tailrace/hono) (`tailraceHono`) for MCP transports and
OpenAI-compatible gateways.

## Documentation

| Resource                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Description                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [Quickstart](https://tailrace.dev/docs/get-started/quickstart)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Block a secret and tokenize email in five minutes   |
| [Boundaries](https://tailrace.dev/docs/concepts/boundaries) · [Policy resolution](https://tailrace.dev/docs/concepts/policy-resolution) · [Detection tiers](https://tailrace.dev/docs/concepts/detection-tiers) · [Tokenization & the vault](https://tailrace.dev/docs/concepts/tokenization-and-the-vault)                                                                                                                                                                                                                              | The mental model, with diagrams                     |
| [Ship an agent](https://tailrace.dev/docs/guides/ship-an-agent-on-vercel)                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Clone, verify, deploy: model, tools, egress restore |
| [Govern MCP tool calls](https://tailrace.dev/docs/guides/govern-mcp-tool-calls)                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Transport wrap + JSON-RPC block                     |
| [Block secrets in Claude Code](https://tailrace.dev/docs/guides/block-secrets-in-claude-code)                                                                                                                                                                                                                                                                                                                                                                                                                                            | Hooks, scan, install-hooks                          |
| [Next.js](https://tailrace.dev/docs/integrations/nextjs) · [MCP](https://tailrace.dev/docs/integrations/mcp) · [Hono](https://tailrace.dev/docs/integrations/hono) · [Express](https://tailrace.dev/docs/integrations/express) · [Fastify](https://tailrace.dev/docs/integrations/fastify) · [NestJS](https://tailrace.dev/docs/integrations/nestjs) · [Encore](https://tailrace.dev/docs/integrations/encore) · [tRPC](https://tailrace.dev/docs/integrations/trpc) · [Claude Code](https://tailrace.dev/docs/integrations/claude-code) | Integration pages                                   |

Full docs: [tailrace.dev](https://tailrace.dev)

## Install

```bash
pnpm add @tailrace/core
```

Zero runtime dependencies. Runs on Node 20+, Cloudflare Workers, and Vercel Edge (WebCrypto only, no
`node:` imports).

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
