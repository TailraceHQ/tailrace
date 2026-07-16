# M7 Implementation Plan: Adapter + OpenAI Agents + Cloudflare Agents

> **Status: complete.** Normative behavior: [`integrations.md`](integrations.md) §6–§8.
> Acceptance: [`milestones.md`](milestones.md) §M7.
> Guides: [`guides/openai-agents-integration.md`](guides/openai-agents-integration.md),
> [`guides/cloudflare-agents-integration.md`](guides/cloudflare-agents-integration.md).

Locked decisions (user-confirmed 2026-07-16):

- **Compose:** `@tailrace/cloudflare-agents` depends on `@tailrace/ai-sdk` for `wrapModel` / `wrapTools` / streaming.
- **Delivery:** One milestone M7 with sequential phases: M7a adapter → M7b openai-agents → M7c cloudflare-agents.
- Architecture package list + dependency rules updated in [`architecture.md`](architecture.md) §1–§3.
- Integrations contain zero policy logic.
- Package README quickstarts required; new `examples/*` apps deferred.

## Explicit non-goals

- LangChain / LangGraph packages
- Microsoft-style DIDs, trust scores, OPA backends
- MCP tool-definition scanner / VS Code extension
- Refactoring Hono to use adapter (optional follow-up)
- Full model-boundary wrap for OpenAI Agents if no stable hook (document + defer)
- Hosted OpenAI tools (web search, file search, etc.)

---

## M7a: `@tailrace/adapter` — done

Shipped: `wrapToolExecute`, `runGoverned`, checkable helpers, `formatToolBlockError`. `@tailrace/ai-sdk` `wrapTools` consumes adapter.

## M7b: `@tailrace/openai-agents` — done

Shipped: `wrapTool` / `wrapTools` / `withOpenAiAgents` against `@openai/agents@0.3.x` `FunctionTool.invoke`.

## M7c: `@tailrace/cloudflare-agents` — done

Shipped: `createCloudflareTailrace`, `withCloudflareAgents().forChat` / `wrapOnToolCall` (Compose).

## Docs checklist

- [x] `architecture.md` §1–§3
- [x] `milestones.md` §M7
- [x] `integrations.md` §6–§8
- [x] Guides + site reference/integrations pages
- [x] Changesets for new packages (add via `pnpm changeset` before publish)
