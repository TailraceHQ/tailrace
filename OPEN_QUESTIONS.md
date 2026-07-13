# Open Questions

Tracks `// SPEC-QUESTION:` items left in the code (docs/AGENTS.md §When uncertain). Each is either
resolved in the docs, locked for v0.1, or explicitly deferred (post-v0.1). Milestone M5 triaged
this list: nothing remains Open for v0.1.

## Open

_(none)_

## Deferred (post-v0.1)

- **Tier 1 NER model choice.** Pick the specific GLiNER-class ONNX model with the best F1-per-MB and
  record candidates + benchmark results here (docs/detection.md §3). _Site:_
  `packages/recognizer-ner/src/index.ts`.

- **wrapTools array/primitive envelope.** `asCheckable` wraps non-object tool args/results as
  `{ value: … }` so object-scan can walk leaves. A tool that natively returns `{ value: … }` is
  fine today (objects pass through unchanged); if we ever need to distinguish the envelope from a
  real `{ value }` payload after unwrapping arrays/primitives, introduce a tagged envelope.
  _Site:_ `packages/ai-sdk/src/wrap-tools.ts`. Same pattern used in `packages/cli/src/commands/hook.ts`
  and `@tailrace/mcp` message helpers.

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
