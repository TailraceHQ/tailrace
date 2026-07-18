# M9 Implementation Plan: HTTP frameworks + tRPC

> **Status: complete.** Normative behavior: [`integrations.md`](integrations.md) §3 / §9–§14.
> Acceptance: [`milestones.md`](milestones.md) §M9.
> Architecture: [`architecture.md`](architecture.md) §1–§3.

Post-M8. Extracts a shared OpenAI-compatible HTTP pipeline into `@tailrace/http`, ships thin
Express / Fastify / NestJS / Encore / Hono adapters on top, and adds `@tailrace/trpc` as
procedure middleware (tool-boundary scanning).

## Locked decisions

| Topic | Decision |
|---|---|
| Product surface (HTTP) | Mirror `@tailrace/hono`: openai-compatible only - scan chat request/response + SSE, model boundary, **422** `{ error: { type: "policy_violation", entity, rule } }`, SSE abort-equivalent (no `streamBlockBehavior`) |
| Product surface (tRPC) | Procedure middleware, not openai-compat REST. Check procedure `input` at `{ kind: "tool", name, direction: "out" }` and result at `direction: "in"`. Block → host-native `TRPCError` with value-free message |
| Package layout | `@tailrace/http` (shared). Thin `@tailrace/express`, `@tailrace/fastify`, `@tailrace/nestjs`, `@tailrace/encore`. Refactor `@tailrace/hono` onto http. Separate `@tailrace/trpc` (core + adapter, not http) |
| Non-goals | Generic JSON body middleware; Nest decorators-as-policy; Encore typed-payload-only path without raw/OpenAI body; tRPC client links; Claude Desktop; new demos beyond package README quickstarts |

## Architecture

```
@tailrace/core ──► @tailrace/http ──► hono / express / fastify / nestjs / encore
@tailrace/core ──► @tailrace/adapter ──► @tailrace/trpc
```

Integrations stay policy-free: construct `Boundary` / `Identity`, call `check` / `restore`,
translate `PolicyViolationError`.

## Phases

### Phase 1: Spec + scaffold + `@tailrace/http` + Hono refactor

1. Write this plan; update architecture / integrations / milestones.
2. Stub workspace packages; eslint `no-restricted-imports` boundaries.
3. Extract `@tailrace/http` from hono internals; unit tests; no host peers.
4. Refactor `@tailrace/hono` onto `@tailrace/http`; existing hono tests stay green.

### Phase 2: Express + Fastify

Full request/response/SSE suites mirroring hono tests.

### Phase 3: NestJS

`TailraceModule.forRoot` + middleware; CI against Nest + Express adapter; document Fastify adapter.

### Phase 4: Encore.ts

`tailraceEncore(tr, opts)` returning Encore `middleware(...)`; target raw openai-compat endpoints.

### Phase 5: tRPC

`createTailraceMiddleware` + fluent `withTrpc`; block/tokenize tests; Option C.

### Phase 6: Docs polish

Per-package README ≤10-line quickstart; guides; site reference pages; changeset.

## Acceptance criteria (CI)

- All new packages build (ESM+CJS+dts); `pnpm test` green
- Gateway packages: request block never hits upstream; tokenize rewrites body; SSE mid-secret split + 422/SSE error shape; no raw fixture secrets in responses/logs
- Hono parity: existing hono tests still pass after refactor
- tRPC: input block, output tokenize, type preservation smoke
- Runtime: `@tailrace/http` Node (+ workerd-friendly Web APIs); framework packages Node-only is fine
- No cross-internal imports; eslint boundaries updated
