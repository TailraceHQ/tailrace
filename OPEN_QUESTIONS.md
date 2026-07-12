# Open Questions

Tracks `// SPEC-QUESTION:` items left in the code (docs/AGENTS.md §When uncertain). Each is either
resolved in the docs, locked for v0.1, or explicitly deferred before v0.1 ships (milestone M5).

## Open

- **Tier 1 NER model choice.** Pick the specific GLiNER-class ONNX model with the best F1-per-MB and
  record candidates + benchmark results here (docs/detection.md §3). _Site:_
  `packages/recognizer-ner/src/index.ts`.

## Locked for v0.1 (M2)

Decided during policy engine + vault implementation. Spec docs updated where noted; remaining
wording may still lag until M5 triage.

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

- **Fluent + standalone API (Option C).** `wrapModel` / `wrapTools` and `withAiSdk(tailrace)` for
  `tailrace.model()` / `tailrace.tools()`. Core stays framework-free; fluent methods live in
  `@tailrace/ai-sdk` only. See docs/integrations.md §1.
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
