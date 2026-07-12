# Open Questions

Tracks `// SPEC-QUESTION:` items left in the code (docs/AGENTS.md §When uncertain). Each is either
resolved in the docs, locked for v0.1, or explicitly deferred before v0.1 ships (milestone M5).

## Open

- **Fluent integration form (`tailrace.model` / `tailrace.tools` / `tailrace.mcp`).** The specs show a
  fluent form on the gate instance (docs/integrations.md §1–2), but `@tailrace/core` cannot import
  host framework types (AI SDK, MCP SDK) without breaking its zero-dependency, edge-safe boundary
  (docs/architecture.md §2). M0 ships the narrower standalone form: `wrapModel(tailrace, model)`,
  `wrapTools(tailrace, tools)`, `wrapTransport(tailrace, transport)`. **Decision needed in M3:** add
  the fluent form via declaration merging + runtime registration on the instance, or keep the
  standalone functions and update the specs. Prefer whichever keeps `core` framework-free.
  _Sites:_ `packages/ai-sdk/src/index.ts`, `packages/mcp/src/index.ts`, `packages/hono/src/index.ts`.

- **Exact host types for integration wrappers.** M0 wrappers are generic over the host object type.
  Bind the real types at implementation time, verified against the installed version (the live
  interface wins on mechanics, docs/conventions.md §Agent workflow notes):
  - `@tailrace/ai-sdk` → `LanguageModel`, `ToolSet`, `wrapLanguageModel` middleware signature (M3).
  - `@tailrace/mcp` → `Transport` from `@modelcontextprotocol/sdk` (M5).
  - `@tailrace/hono` → `MiddlewareHandler` / `Context` (M5).

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

_(none yet - promote "Locked for v0.1" items here once the normative specs fully absorb them)_
