# M5 Implementation Plan: MCP + Hono + polish

> **Status: complete.** Acceptance criteria in [`milestones.md`](milestones.md) §M5 are checked off.
> This file is retained as the historical build plan; normative runtime behavior lives in
> [`integrations.md`](integrations.md) §2–§3, §5.
> User guides: [`guides/mcp-integration.md`](guides/mcp-integration.md),
> [`guides/hono-integration.md`](guides/hono-integration.md).
> Docs site: `/docs/guides/govern-mcp-tool-calls`, `/docs/integrations/mcp`, `/docs/integrations/hono`,
> `/docs/reference/mcp`, `/docs/reference/hono`.

Normative acceptance: [`milestones.md`](milestones.md) §M5. Mechanics: [`integrations.md`](integrations.md) §2–§3, §5. Mirror prior plans: [`m3-plan.md`](m3-plan.md) / [`m4-plan.md`](m4-plan.md).

**Out of scope for M5:** new demo apps (Demos 1–3 already covered); Claude Desktop MCP shim (v0.2); Hono `streamBlockBehavior` knobs; extracting shared stream code into core; Tier 1 NER model selection (explicit defer).

## Locked decisions (pre-flight)

| Topic | Decision |
|---|---|
| Public API | **Option C**: standalone + fluent. MCP: `wrapTransport` + `withMcp(tailrace).transport(...)`. Hono: `tailraceHono` only (no fluent attach needed). |
| MCP peer | `@modelcontextprotocol/sdk` `>=1`; bind `Transport` against the **installed** SDK (`@modelcontextprotocol/sdk/shared/transport`). As of `1.29.0`: `start` / `send` / `close` / `onclose` / `onerror` / `onmessage` / optional `sessionId` / `setProtocolVersion`. |
| Intercepted methods | Outbound: `tools/call` params. Inbound: `tools/call` results + `resources/read` results. All other JSON-RPC messages pass through. |
| Boundaries | Out: `{ kind: "mcp", server, tool, direction: "out" }`. In: same with `direction: "in"`. `server` from `McpWrapOptions.server`; `tool` from `params.name` (tools/call) or `"read"` for resources/read (stable policy key; not URI basename). |
| Block (MCP) | Do **not** tear down the transport. Synthesize a JSON-RPC 2.0 **error response** for the pending request id: `code: -32001`, `message` naming entity + rule (never raw value), `data: { type: "policy_violation", entity, rule }`. Apply for both outbound block (never `send` to server) and inbound block (replace result before `onmessage`). |
| Tokenize/mask (MCP) | Rewrite `arguments` / result payloads via `check` output; forward rewritten message. |
| Hono peer | `hono` `>=4`; bind `MiddlewareHandler` / `Context` from `hono` (`MiddlewareHandler = (c, next) => Promise<R \| void>`). |
| Hono mode | Only `"openai-compatible"` in v0.1 (default). |
| Hono boundary | `{ kind: "model", provider }` where `provider` = request body `model` string **as-is**. |
| Hono block (request) | Before `next()`: **422** JSON `{ error: { type: "policy_violation", entity, rule } }`. |
| Hono block (JSON response) | After upstream returns non-SSE: scan body; on block return **422** (do not forward the blocked body). |
| Hono block (SSE) | After headers started: **abort-equivalent** only - cancel upstream, emit one SSE `data:` error object matching the 422 shape, then close. No `streamBlockBehavior` option in v0.1. |
| Carry-buffer | **Local reimplementation** inside `@tailrace/hono` (same algorithm as ai-sdk). Must **not** import `@tailrace/ai-sdk`. Shared extraction deferred. |
| Identity / workflow | MCP: `agent` + `workflowId` from opts (defaults `"default"`). Hono: `agent(c)` from opts; optional `workflowId?: string \| ((c) => string)`. |
| Examples | **No** new `examples/*` apps required by M5 checkboxes; package README quickstarts + unit/integration tests only. |
| First version | Changeset bumps publishable packages **0.0.0 → 0.1.0**; generate per-package `CHANGELOG.md` via changesets. |
| OPEN_QUESTIONS | Resolve MCP/Hono type binding by implementing; **defer** Tier 1 NER model choice and wrapTools `{ value }` envelope to post-v0.1; remove stale locked SPEC-QUESTION comments in core. |

---

## Phase 0: Live contracts + scaffold

**Goal:** Compile against real peers; types replace `unknown` stubs.

1. Add to `packages/mcp`: peer+devDep `@modelcontextprotocol/sdk`, vitest, expect-type. Bind `Transport`.
2. Add to `packages/hono`: peer+devDep `hono`, vitest. Bind `MiddlewareHandler`.
3. Expand public types (`McpWrapOptions`, `TailraceHonoOptions` + `workflowId`); remove SPEC-QUESTION comments once bound.
4. Patch [`integrations.md`](integrations.md) §2–§3 for SDK/Hono drift.
5. Write this plan; link from [`milestones.md`](milestones.md) §M5.

**Exit:** both packages typecheck; stubs still throw until Phase 1/3 (or full bodies land in later phases of the same effort).

---

## Phase 1: `@tailrace/mcp` transport wrapper

**Goal:** Intercept `tools/call` end-to-end without policy logic in the package.

```
packages/mcp/src/
  index.ts
  types.ts
  wrap-transport.ts
  fluent.ts
  internal/
    context.ts
    jsonrpc.ts
    messages.ts
```

1. Proxy/wrap the transport: preserve type `T extends Transport`.
2. On `send` of `tools/call`: `check(arguments, mcp out)` → rewrite or synthesize error via `onmessage`.
3. On inbound `tools/call` result: `check` at `direction: "in"` → rewrite or replace with error.
4. Forward `onDecision` per shared integration rules.

**Exit:** `pnpm --filter @tailrace/mcp test` green.

---

## Phase 2: MCP `resources/read` + fluent API

1. Scan `resources/read` **results** only (`direction: "in"`); `tool: "read"`.
2. Implement `withMcp(tailrace).transport(transport, opts)`.
3. Expand README to ≤10-line quickstart + API notes.

**Exit:** resources/read tests + fluent export covered.

---

## Phase 3: `@tailrace/hono` request path

**Goal:** OpenAI chat-completions request scan + 422.

```
packages/hono/src/
  index.ts
  types.ts
  middleware.ts
  internal/
    context.ts
    openai-body.ts
    errors.ts
    sse.ts
    carry-buffer.ts
```

1. `tailraceHono(tailrace, opts)` returns `MiddlewareHandler`.
2. Read JSON body; `check` message text at model boundary; on block → 422.
3. On tokenize: forward rewritten body to `next()`.

**Exit:** request-path tests green.

---

## Phase 4: Hono response + SSE carry-buffer

1. After `next()`, inspect `Content-Type`:
   - `text/event-stream`: carry-buffer transform; on block → cancel upstream, emit SSE error, close.
   - JSON chat completion: scan assistant text; block → 422; tokenize → rewrite body.
2. Adversarial chunk tests (1-char, mid-secret) for SSE.
3. Expand [`packages/hono/README.md`](../packages/hono/README.md).

**Exit:** SSE + JSON response tests green; package typecheck green.

---

## Phase 5: README polish

1. Root README: update status to M5/v0.1; link mcp/hono install snippets. **Done**
2. `packages/core/README.md`: remove stale M0 banner; document real public API. **Done**
3. Ensure each integration README has a copy-paste quickstart ≤ 10 lines. **Done**
4. Docs site + repo guides for MCP/Hono (govern-mcp guide, integrations/reference pages, `docs/guides/*-integration.md`). **Done**

**Exit:** docs-only review; no behavior change.

---

## Phase 6: OPEN_QUESTIONS triage

| Item | Disposition |
|---|---|
| MCP Transport binding | **Resolved** |
| Hono MiddlewareHandler binding | **Resolved** |
| Tier 1 NER model choice | **Deferred** post-v0.1 |
| wrapTools `{ value }` envelope | **Deferred** post-v0.1 |
| Stale comments in `resolve.ts` / `validate.ts` | **Remove** (already Locked) |

Update [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md); clear remaining `SPEC-QUESTION` in `packages/`.

---

## Phase 7: Changesets + milestone close

1. Changeset covering publishable packages for **0.1.0**.
2. Generate per-package `CHANGELOG.md`.
3. Check off M5 boxes in [`milestones.md`](milestones.md); mark this plan complete.

**Exit:** M5 acceptance criteria all true.

---

## Out of scope (M5)

- New demo apps
- Claude Desktop MCP shim
- Hono `streamBlockBehavior` option
- Shared carry-buffer extraction into core
- Tier 1 NER model selection
