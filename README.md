# Tailrace

**Agent data governance for TypeScript.** In-process detection of secrets and PII, reversible
workflow-scoped tokenization, and per-agent data-flow policy enforced at the model, tool, and MCP
boundaries. No proxy, no sidecar, no network call in the request hot path.

> Status: **early development (v0.1, milestone M0 - repo skeleton).** The public API surface and
> package boundaries are in place; detection, policy, vault, and integrations land across milestones
> M1–M5. See [`docs/milestones.md`](docs/milestones.md).

## Why

Agents move data across trust boundaries constantly - into model providers, out through tools, over
MCP. Tailrace sits in-process at those boundaries, detects sensitive values, and applies a policy you
control: block secrets, tokenize PII reversibly so the same value gets the same token across a whole
workflow, and restore it only at trusted egress.

## Packages

| Package                                               | What it is                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [`@tailrace/core`](packages/core)                     | Detection, policy engine, vault, audit. Zero runtime deps; runs on Node, Cloudflare Workers, and Vercel Edge. |
| [`@tailrace/ai-sdk`](packages/ai-sdk)                 | Vercel AI SDK middleware + tool wrapper.                                                                      |
| [`@tailrace/mcp`](packages/mcp)                       | MCP client transport wrapper.                                                                                 |
| [`@tailrace/hono`](packages/hono)                     | Hono middleware (OpenAI-compatible passthrough).                                                              |
| [`@tailrace/cli`](packages/cli)                       | `tailrace` binary: `init`, `scan`, `install-hooks`, `hook`.                                                   |
| [`@tailrace/recognizer-ner`](packages/recognizer-ner) | Optional Tier 1 ONNX NER recognizer (Node only).                                                              |

## Quickstart

```ts
// Ships with milestone M3.
import { createTailrace } from "@tailrace/core";
import { openai } from "@ai-sdk/openai";

const tailrace = createTailrace(); // zero config: secrets blocked, common PII tokenized
const model = tailrace.model(openai("gpt-4o"));
// Use `model` anywhere you'd use the AI SDK model - sensitive values never leave the process.
```

## Development

```bash
pnpm install
pnpm build        # tsup: ESM + CJS + .d.ts for every package
pnpm test         # vitest (core also runs under workerd via test:workers)
pnpm lint
pnpm typecheck
pnpm bench        # perf gates; compared against benchmarks/baseline.json
```

Contributor guide and build order: [`AGENTS.md`](AGENTS.md). Specs: [`docs/`](docs). The specs are
normative - when in doubt, docs win.

## License

MIT
