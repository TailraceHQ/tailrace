# Open Questions

Tracks `// SPEC-QUESTION:` items left in the code (docs/AGENTS.md §When uncertain). Each is either
resolved in the docs, locked for v0.1, or explicitly deferred (post-v0.1). Milestone M5 triaged
the v0.1 list. **M8** reopened Tier 1 NER items under §Open - those block `@tailrace/recognizer-ner`
implementation until answered.

## Open

### M8-6. Benchmark protocol / results

Record Privacy Filter (pinned artifact) vs at least one GLiNER-class candidate: span-level F1
per mapped entity, disk MB, RSS, p50 ms on a fixed synthetic fixture. Results land here when
measured; until then default runtime path is **local `modelPath`** (no auto-download in CI).

_Track:_ docs/m8-plan.md Phase 3.

## Deferred (post-v0.1 / post-M8)

- **tRPC streaming procedures.** `@tailrace/trpc` v0.1 supports non-streaming queries/mutations
  only. Streaming procedure support deferred. _Site:_ `packages/trpc/src/middleware.ts`
  (`// SPEC-QUESTION:`). _Track:_ docs/m9-plan.md.

- **Custom pattern `validate()` callback.** Optional per-match `validate(match, text) => boolean` on
  `definePatternRecognizer` deferred to keep Tier 0 sync contract simple. Track in
  [`docs/m6-plan.md`](docs/m6-plan.md) §Unresolved. _Planned:_ post-M6e.

- **Policy-plane recognizer sync.** Remote sync of recognizer definitions (beyond local
  `.tailrace/config.json`) deferred. M6d covers CLI JSON only. _Track:_
  [`docs/m6-plan.md`](docs/m6-plan.md) §M6d.

- **Playground pattern persistence.** Session-only state in M6e; localStorage or share-URL persistence
  deferred. _Track:_ [`docs/m6-progress.md`](docs/m6-progress.md) §Deferred beyond M6.

- **Fail-closed on broken `block` recognizer.** Optional `detectionFailure: "block"` policy knob when
  a `block`-configured entity's recognizer fails at runtime. M6 documents the gap (fail-open skip).
  _Track:_ [`docs/m6-plan.md`](docs/m6-plan.md) §Unresolved.

- **Tier 1 on edge / browser.** architecture.md keeps recognizer-ner off Workers/Edge for now;
  transformers.js / WebGPU path deferred. _Track:_ docs/m8-plan.md non-goals.

- **wrapTools array/primitive envelope.** `asCheckable` wraps non-object tool args/results as
  `{ value: … }` so object-scan can walk leaves. A tool that natively returns `{ value: … }` is
  fine today (objects pass through unchanged); if we ever need to distinguish the envelope from a
  real `{ value }` payload after unwrapping arrays/primitives, introduce a tagged envelope.
  _Site:_ `packages/ai-sdk/src/wrap-tools.ts`. Same pattern used in `packages/cli/src/commands/hook.ts`
  and `@tailrace/mcp` message helpers.

## Locked for M8

User-confirmed 2026-07-17. Spec docs (`detection.md` §3, `policy-engine.md` §2) update when M8 implements.

- **M8-1. Default model family.** Tier 1 is **opt-in** (most users never install a model). Leading
  candidate: OpenAI Privacy Filter; GLiNER-class remains a benchmark comparator. F1-per-MB is
  recorded for honesty, not the sole selection criterion (memory-heavy opt-in is acceptable).
  Exact default download artifact still follows M8-4 + M8-6 results.
  _Site:_ `packages/recognizer-ner`, docs/detection.md §3.

- **M8-2. Entity taxonomy mapping.**

  | Model label       | → EntityClass     | Core types                                   |
  | ----------------- | ----------------- | -------------------------------------------- |
  | `secret`          | `secret`          | add to `SecretEntityClass` (block invariant) |
  | `account_number`  | `account_number`  | new (NER/PII-adjacent; not secret)           |
  | `private_person`  | `person`          | existing `NerEntityClass`                    |
  | `private_address` | `private_address` | new                                          |
  | `private_email`   | `email`           | existing Tier 0 `PiiEntityClass`             |
  | `private_phone`   | `phone`           | existing Tier 0 `PiiEntityClass`             |
  | `private_url`     | `private_url`     | new                                          |
  | `private_date`    | `private_date`    | new                                          |

  New classes (`account_number`, `private_address`, `private_url`, `private_date`) are **unset in
  `defaultPolicy()`** → fall through to `defaults.action` (`allow`). Document that `email`→`tokenize`
  (existing Tier 0 default) can break agent “lookup by email” flows unless policy allows email or
  the host supplies the address outside the model path; `restore` remains egress-only.

- **M8-3. Default policy when Tier 1 is installed (option C).** Registering `nerRecognizer()` does
  **not** silently mutate policy. Export an opt-in recommended fragment (e.g.
  `nerRecommendedPolicy()` / merge helper) that users compose with `definePolicy` /
  `createTailrace({ policy })`. Separately: because `secret` is a `SecretEntityClass`,
  `defaultPolicy()` includes `secret` → `block` like other secrets (no spans unless a recognizer
  emits them). Fragment is for customizable NER-aware PII rules beyond that.
  _Site:_ `packages/recognizer-ner`, `packages/core/src/policy/default.ts`.

- **M8-4. ONNX artifact.** Prefer official `openai/privacy-filter` hub files; default filename
  when resolving a model dir: `model_q4.onnx` (smaller), override via `onnxFile`. No
  Tailrace-owned export unless official builds fail. Hub auto-download is optional later;
  M8 requires `modelPath` (directory or `.onnx` file) for real inference. Pin revision when
  download lands.
  _Site:_ `packages/recognizer-ner`.

- **M8-5. Async engine + overlap.** `detect` is async; await Promise `scan` results. Tier 1
  throw / load failure → skip that recognizer + one warning (fail open). Tier 0 stays sync
  inside the async loop. Overlap: existing merge (same entity → union; different → keep both +
  most-restrictive-action). No special case for Tier 1 `secret` vs Tier 0 `api_key`.
  _Site:_ `packages/core/src/detect/engine.ts`.

## Locked for v0.1 (M2)

Decided during policy engine + vault implementation. Spec docs updated where noted.

- **Boundary key encoding.** model → provider string; tool → `tool:{name}:{direction}`; mcp →
  `mcp:{server}/{tool}`; telemetry → `telemetry`; egress → `egress:{sink}`. Glob `*` matches
  remainder; exact > longer glob > shorter; matching is kind-scoped (model globs never match
  prefixed tool/mcp/egress/telemetry keys).
  _Sites:_ `packages/core/src/policy/boundary.ts`, docs/policy-engine.md §3.

- **Default policy document.** All `SecretEntityClass` → `block`; common structured PII
  (`email`, `phone`, `credit_card`, `iban`, `ssn`) → `tokenize`; `ip_address` → `allow`;
  `url_credentials` → `block`; NER unset (falls through to `defaults.action` = `allow`);
  `boundaries["egress:*"].entities["*"]` → `detokenize`.
  _Sites:_ `packages/core/src/policy/default.ts`, docs/policy-engine.md §2.

- **detokenize as Action.** `Action` includes `"detokenize"`; runtime validation rejects it outside
  egress boundary keys. Spec §1 Action union updated to match.
  _Sites:_ `packages/core/src/types.ts`, `packages/core/src/policy/validate.ts`,
  docs/policy-engine.md.

- **Mask label configurability.** `[${entity.toUpperCase()}]` with no per-entity override yet.
  _Sites:_ `packages/core/src/vault/token.ts` (`maskLabel`).

- **block-pii membership.** All `PiiEntityClass` + all `NerEntityClass`.
  _Sites:_ `packages/core/src/policy/resolve.ts`.

- **Token-id alphabet.** Custom lowercase alphanumeric `[a-z0-9]` (not RFC 4648 base32), shared by
  generation and restore regexes. Documented in docs/vault.md §1.
  _Sites:_ `packages/core/src/vault/alphabet.ts`, docs/vault.md.

## Resolved

- **MCP Transport binding.** Bound against `@modelcontextprotocol/sdk@1.29.0`
  `Transport` from `@modelcontextprotocol/sdk/shared/transport`
  (`start` / `send` / `close` / `onclose` / `onerror` / `onmessage`). See docs/integrations.md §2
  and docs/m5-plan.md.
  _Was:_ Open (M5 Phase 0).

- **Hono MiddlewareHandler binding.** Bound against `hono@4.12.x` `MiddlewareHandler` /
  `Context`. See docs/integrations.md §3 and docs/m5-plan.md.
  _Was:_ Open (M5 Phase 0).

- **Fluent + standalone API (Option C).** `wrapModel` / `wrapTools` and `withAiSdk(tailrace)` for
  `tailrace.model()` / `tailrace.tools()`. Core stays framework-free; fluent methods live in
  `@tailrace/ai-sdk`. MCP mirrors with `wrapTransport` + `withMcp`. See docs/integrations.md §1–§2.
  _Was:_ Locked for v0.1 (M3).

- **AI SDK version pin.** `ai@^5` peer; types bound against installed `LanguageModelV2` middleware
  (`@ai-sdk/provider@2.x` matching `ai@5.0.x`).
  _Was:_ Locked for v0.1 (M3) / Open (partial).

- **Model boundary for input and output.** Both use `{ kind: "model", provider }`. Do not use
  `telemetry` for AI SDK middleware in v0.1.
  _Was:_ Locked for v0.1 (M3).

- **Provider encoding.** `${providerId}/${modelId}`; gateway-style model IDs with `/` used as-is.
  _Was:_ Locked for v0.1 (M3).

- **Streaming output block modes.** `streamBlockBehavior`: `abort` (default), `buffer`, `redact`
  (`applyBlockAs: "mask"`). Non-stream generate always throws on block.
  _Was:_ Locked for v0.1 (M3).

- **Demo 1 semantics.** Block = secret never reaches provider; mock model default; egress restore
  explicit in route handler (`examples/nextjs-ai-sdk`).
  _Was:_ Locked for v0.1 (M3).

- **CLI commands (v0.1).** `init`, `scan`, `install-hooks`, `hook` only - no subcommand aliases.
  _Was:_ Locked for v0.1 (M4). See docs/integrations.md §4.

- **Claude Code hook I/O.** JSON path exclusively (exit 0 for policy decisions). Clean allow =
  empty stdout; tokenize/mask = `permissionDecision: "allow"` + full `updatedInput`; block =
  `permissionDecision: "deny"` + reason (entity + rule). Never exit-code-2 for policy deny.
  Verified against https://code.claude.com/docs/en/hooks at M4.
  _Was:_ Locked for v0.1 (M4).

- **Hook config + vault.** Hook loads `.tailrace/config.json` only (no TS transpile). File-backed
  `kvVault` under `.tailrace/vault/`; master key from config or `TAILRACE_VAULT_KEY`. Agent default
  `"claude-code"`; `workflowId` = Claude Code `session_id`. PostToolUse audit-only (no rewrite/deny).
  Matcher `"*"` for PreToolUse + PostToolUse. `install-hooks` non-destructive with backup.
  _Was:_ Locked for v0.1 (M4).

- **No `filePolicy` in core.** Config loading stays in `@tailrace/cli`. architecture.md §5 updated.
  _Was:_ Locked for v0.1 (M4).

- **Demo 2 in CI.** Scripted stdin fixtures for the hook binary; live Claude Code walkthrough is
  human-only. Dogfood: CI runs `tailrace scan` once the command lands (exclude intentional fixtures).
  _Was:_ Locked for v0.1 (M4).

- **MCP Option C + block synthesis.** `wrapTransport` / `withMcp`; outbound `tools/call` + inbound
  tool / `resources/read` results; block → JSON-RPC `-32001` without tearing down the transport.
  See docs/integrations.md §2.
  _Was:_ Locked for v0.1 (M5).

- **Hono openai-compatible middleware.** `tailraceHono`; model boundary from body `model` as-is;
  request/JSON response block → 422; SSE abort-equivalent only (local carry-buffer, no ai-sdk import).
  See docs/integrations.md §3.
  _Was:_ Locked for v0.1 (M5).
