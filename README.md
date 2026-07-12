<p align="center">
  <img src="assets/logo/lightmode-logo.svg#gh-light-mode-only" alt="Tailrace" width="96" />
  <img src="assets/logo/darkmode-logo.svg#gh-dark-mode-only" alt="Tailrace" width="96" />
</p>

# Tailrace

**Agent data governance for TypeScript.** In-process detection of secrets and PII, reversible
workflow-scoped tokenization, and per-agent data-flow policy enforced at the model, tool, and MCP
boundaries. No proxy, no sidecar, no network call in the request hot path.

> Status: **early development (v0.1, milestone M3).** Detection, policy, vault, audit, and the
> Vercel AI SDK integration ship in `@tailrace/core` + `@tailrace/ai-sdk`.

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
import { createTailrace } from "@tailrace/core";
import { withAiSdk } from "@tailrace/ai-sdk";
import { openai } from "@ai-sdk/openai";

const tailrace = withAiSdk(createTailrace()); // zero config: secrets blocked, common PII tokenized
const model = tailrace.model(openai("gpt-4o"));
// Use `model` anywhere you'd use the AI SDK model - sensitive values never leave the process.
```

Runnable demos: [`examples/nextjs-ai-sdk`](examples/nextjs-ai-sdk).

## Documentation

| Resource                                                                            | Description                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| [Quickstart](apps/web/content/docs/get-started/quickstart.mdx)                      | Block a secret and tokenize email in five minutes |
| [Protect PII in the AI SDK](apps/web/content/docs/guides/protect-pii-in-ai-sdk.mdx) | Models, tools, streaming, egress restore          |
| [@tailrace/ai-sdk reference](apps/web/content/docs/reference/ai-sdk/index.mdx)      | `wrapModel`, `wrapTools`, options                 |
| [Next.js integration](apps/web/content/docs/integrations/nextjs.mdx)                | Runnable Demo 1                                   |
| [Package README](packages/ai-sdk/README.md)                                         | Install and API overview                          |
| [Integrations spec](docs/integrations.md)                                           | Normative behavior                                |

Run the docs site locally: `pnpm --filter @tailrace/web dev`.

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
