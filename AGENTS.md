# AGENTS.md: Build Instructions (Master Prompt)

You are building an open-source, TypeScript-native **agent data governance library**: in-process detection, reversible tokenization, and per-agent data-flow policy enforced at the model boundary, the tool boundary, and the MCP boundary. Read this file fully before writing any code. The `docs/` folder is normative - when in doubt, docs win over your instincts.

## Naming

The product name is **Tailrace**. Use the npm scope `@tailrace/*` and the CLI name `tailrace` everywhere.

## Prime directives (violations = failed task)

1. **In-process only.** No proxy mode, no sidecar, no required Docker container, no required network call in any request hot path. If a design requires the request path to wait on a network response, it is wrong.
2. **TypeScript only.** Strict mode. No Python anywhere in the runtime. Node >= 20; core must also run on Cloudflare Workers and Vercel Edge/Fluid runtimes (no Node-only APIs in `@tailrace/core` - see docs/architecture.md for the runtime matrix).
3. **Detection is a commodity; policy is the product.** Do not attempt to train models or improve NER accuracy. Detection engines are pluggable. Effort goes into the policy engine, vault, integrations, and audit.
4. **Fail closed for `block` policies, fail open for availability.** If the detection engine throws, a `block`-configured entity class must block; a missing optional model (Tier 1) must degrade to Tier 0 with a logged warning, never crash the host app.
5. **Zero required config.** `createTailrace()` with no arguments must work and must enforce the default policy: all secret classes → `block`, common PII → `tokenize`. Every knob has a sensible default.
6. **Never log raw sensitive values.** Audit events, error messages, and debug logs carry hashes and entity types, never detected values. This includes test fixtures committed to the repo - use obviously-fake values.
7. **Performance budgets are acceptance criteria**, not aspirations: Tier 0 scan p50 < 5ms on a 4KB input; core bundle (no ONNX model) < 60KB gzipped; zero network calls in hot path. CI must measure and fail on regression (see docs/conventions.md).

## Repo shape

Turborepo monorepo, pnpm workspaces. Packages and their responsibilities are specified in `docs/architecture.md`. Do not create packages not listed there without updating that doc first.

## Build order

Work through the milestones in `docs/milestones.md` **strictly in order** (M0 → M5). Each milestone has acceptance criteria; do not start milestone N+1 until N's criteria pass in CI. Within a milestone, write the public API types first, then tests against those types, then implementation.

## Reading list (before coding)

| File | What it specifies |
|---|---|
| docs/architecture.md | Monorepo layout, package boundaries, runtime matrix, dependency rules |
| docs/policy-engine.md | Policy types, resolution algorithm, actions, identity model - THE core spec |
| docs/detection.md | Tier 0 recognizers (full list), Tier 1 ONNX interface, custom recognizer API |
| docs/vault.md | Tokenization formats, HMAC scheme, vault adapters, detokenization rules |
| docs/integrations.md | AI SDK middleware, tool wrapper, MCP wrapper, Hono middleware, Claude Code hook CLI |
| docs/milestones.md | Phased plan with acceptance criteria and demo requirements |
| docs/conventions.md | Code style, testing, error taxonomy, perf CI, release process |

## Explicit non-goals for v0.1 (do not build, even if it seems easy)

- Prompt-injection detection, jailbreak detection, toxicity/content safety
- Python SDK or bindings
- Proxy/gateway deployment mode
- Policy plane server, dashboard, or any hosted component (design the client-side sync interface only, per docs/architecture.md §5)
- Claude Desktop MCP shim (v0.2)
- Human-in-the-loop `review` action (define the type, throw `NotImplementedError`)
- Tier 1 ONNX on edge runtimes (Node/Fluid only in v0.1)

## Definition of done (v0.1 overall)

All milestone acceptance criteria green in CI; the three demos in docs/milestones.md §Demos run from a fresh clone with documented commands; README quickstart takes a new user from `pnpm add @tailrace/core @tailrace/ai-sdk` to a working tokenizing middleware in under 10 lines of code; no TODOs in public API surfaces; CHANGELOG and per-package READMEs exist.

## When uncertain

If the docs are ambiguous or contradictory: (1) prefer the narrower interpretation that keeps the public API smaller, (2) leave a `// SPEC-QUESTION:` comment at the site, (3) list all SPEC-QUESTION items in `OPEN_QUESTIONS.md` at repo root. Do not silently expand scope.
