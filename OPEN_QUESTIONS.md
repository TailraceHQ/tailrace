# Open Questions

Tracks `// SPEC-QUESTION:` items left in the code (docs/AGENTS.md §When uncertain). Each is either
resolved in the docs or explicitly deferred to a milestone before v0.1 ships (milestone M5).

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

## Resolved

_(none yet)_
