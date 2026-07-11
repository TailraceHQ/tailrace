# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A spec kit for building an open-source, TypeScript-native **agent data governance library**: in-process detection of secrets/PII, reversible tokenization, and per-agent data-flow policy enforced at the model, tool, and MCP boundaries. There is no code yet - the repo currently contains only specs, and the task is to build the library from them.

**Read `AGENTS.md` first.** It is the master build prompt and links every spec. The spec docs are normative: when a spec and your instincts disagree, the spec wins. The specs live in `docs/` (`architecture.md`, `policy-engine.md`, `detection.md`, `vault.md`, `integrations.md`, `milestones.md`, `conventions.md`); `AGENTS.md` and this file stay at the repo root.

## Naming

The product name is **Tailrace**: npm scope `@tailrace/*`, CLI name `tailrace`.

## Prime directives (from AGENTS.md - violations fail the task)

1. **In-process only.** No proxy, sidecar, or network call in any request hot path.
2. **TypeScript only, strict mode.** Node >= 20; `@tailrace/core` must also run on Cloudflare Workers and Vercel Edge (no `node:` imports, no `Buffer`, WebCrypto only, no filesystem).
3. **Detection is a commodity; policy is the product.** Detection engines are pluggable; effort goes into the policy engine, vault, integrations, and audit.
4. **Fail closed for `block` policies, fail open for availability.** A missing optional Tier 1 model degrades to Tier 0 with a warning, never crashes the host.
5. **Zero required config.** `createTailrace()` with no args enforces the default policy (secrets → block, common PII → tokenize).
6. **Never log raw sensitive values** - not in audit events, errors, debug logs, or test fixtures (fixtures use synthetic values: 4242 cards, 555 phones, example.com emails, `sk_test_...FAKE` keys).
7. **Performance budgets are CI acceptance criteria**: Tier 0 4KB scan p50 < 5ms; core bundle < 60KB gzipped; policy resolve < 1µs/span; hook spawn-to-exit p50 < 150ms.

## Build order

Follow `milestones.md` strictly in order (M0 → M5); each milestone's acceptance criteria must pass in CI before starting the next. Within a milestone: public API types first, then tests against those types, then implementation. Explicit v0.1 non-goals are listed in AGENTS.md - do not build them even if easy.

## Architecture (see architecture.md for full detail)

Turborepo + pnpm workspaces monorepo. Packages:

- `packages/core` (`@tailrace/core`) - detection, policy engine, vault, audit. **Zero runtime dependencies.** Public exports are limited to: `createTailrace`, `definePolicy`, `defineRecognizer`, `memoryVault`, `kvVault`, `staticPolicy`, error classes, and public types.
- `packages/ai-sdk`, `packages/mcp`, `packages/hono`, `packages/cli` - integrations; depend on `core` plus their host framework as a **peer dependency**. Integrations contain zero policy logic: they construct `Boundary`/`Identity`, call `tailrace.check`/`tailrace.restore`, and translate `PolicyViolationError` into the host's failure mode.
- `packages/recognizer-ner` - optional Tier 1 ONNX recognizer; `core` must never import it.
- No package imports another's internals - public entry points only, enforced via eslint `no-restricted-imports`.

Core data flow: `input → detect (spans) → policy resolve (span × boundary × identity → action) → apply actions → { output, decisions[] } → audit emit (async)`. Objects are scanned by walking string leaves with JSON-pointer paths - never serialize an object to one string for scanning.

Key invariants baked into the design:

- `block` for secret-class entities cannot be overridden to `allow` by a more specific rule without `dangerouslyAllowSecrets: true`.
- Detokenization only ever happens at `egress` boundaries - `restore` at any other boundary throws `InvariantViolationError` regardless of policy.
- Tokens are workflow-scoped deterministic: HMAC-derived per `(workflowId, entityClass, normalizedValue)`; vault values encrypted at rest (AES-256-GCM).
- Tier 0 recognizers must be synchronous; policy resolution must be pure and synchronous.

## Commands (planned tooling, per architecture.md and milestones.md)

- Build: `pnpm build` (tsup, ESM+CJS+dts, orchestrated by Turborepo)
- Test: `pnpm test` (Vitest; core suite runs under both Node and workerd pools via `@cloudflare/vitest-pool-workers`)
- Single test: `pnpm vitest run <path/to/file.test.ts>` within the package
- Benchmarks: run from `/benchmarks`; results gated against `benchmarks/baseline.json` (>20% regression fails CI; intentional changes update the baseline in the same PR with justification)

## Conventions (see conventions.md)

- `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`. No `any` in public APIs; internal `any` needs a `// why:` comment. Public functions get TSDoc with one usage example.
- All errors extend `TailraceError { code }`; error messages never contain detected values (enforced by a test).
- Property-based tests (fast-check) required for: policy resolution precedence, span merging, token determinism, streaming carry buffer. Type-level tests via `expect-type` for all wrapper APIs.
- Coverage gates: 90% lines on `core/src/policy` and `core/src/vault`, 80% elsewhere.
- Conventional commits; changesets for versioning; packages version independently.
- Before implementing against an external API surface (AI SDK middleware, MCP SDK transports, Claude Code hooks JSON contract), read the current docs/source of the installed version - the specs describe intent, the live interface wins on mechanics. Record any drift by updating the relevant spec doc in the same PR.

## When specs are ambiguous

Prefer the narrower interpretation that keeps the public API smaller, leave a `// SPEC-QUESTION:` comment at the site, and list all such items in `OPEN_QUESTIONS.md` at the repo root. Do not silently expand scope.
