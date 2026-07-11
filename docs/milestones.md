# Milestones & Acceptance Criteria

Strict order. A milestone is done when every checkbox passes in CI from a clean clone.

## M0 — Repo skeleton
- [ ] pnpm + Turborepo monorepo with all packages from architecture.md §1 stubbed (types + `NotImplementedError` bodies)
- [ ] tsup builds ESM+CJS+dts for every package; `pnpm build` green
- [ ] Vitest wired incl. workers pool for core; `pnpm test` green (empty suites fine)
- [ ] eslint + prettier + no-restricted-imports boundary rule; CI workflow runs build/test/lint/bench on PR
- [ ] benchmarks/ harness runs a placeholder benchmark and enforces a threshold (proves the perf-gate mechanism)

## M1 — Detection (Tier 0)
- [ ] All Tier 0 recognizers from detection.md §2 with validators
- [ ] Fixture corpus per entity (synthetic values only); precision/recall gates ≥ 0.95 enforced in CI
- [ ] Span merging per detection.md §4; object scanning per §5
- [ ] Perf gate: 4KB fixture p50 < 5ms in CI benchmark
- [ ] Core bundle size gate: < 60KB gzipped, enforced in CI

## M2 — Policy engine + vault
- [ ] `definePolicy` with full typing + runtime validation; resolution algorithm per policy-engine.md §3 with property-based tests (fast-check) over rule precedence
- [ ] Secrets-cannot-be-allowed rule + `dangerouslyAllowSecrets` escape hatch
- [ ] `tailrace.check` and `tailrace.restore` end-to-end; actions incl. format-preserving tokenization
- [ ] memoryVault + kvVault with encrypted-at-rest test (vault.md §6 complete)
- [ ] Audit emitter with console + JSONL sinks; every decision carries rule path + contentHash, zero raw values (test greps audit output for fixture values)
- [ ] Default zero-config policy works: `createTailrace()` blocks a Stripe key, tokenizes an email
- [ ] Core suite passes under workerd

## M3 — AI SDK integration
- [ ] `tailrace.model` transformParams + wrapGenerate + wrapStream per integrations.md §1
- [ ] Streaming carry-buffer with adversarial chunking tests (1-char chunks, split tokens)
- [ ] `tailrace.tools` with exact type preservation (type-level tests via expect-type)
- [ ] examples/nextjs-ai-sdk runs Demos 1 & 3 (below)

## M4 — Claude Code CLI
- [ ] `tailrace init`, `tailrace scan`, `tailrace install-hooks` (non-destructive settings merge with backup), `tailrace hook`
- [ ] Hook handler meets the output contract in integrations.md §4 — verified against the live Claude Code hooks reference at implementation time (update the doc if it drifted)
- [ ] Hook p50 < 150ms measured in CI (spawn-to-exit on a representative tool_input)
- [ ] examples/claude-code walkthrough runs Demo 2

## M5 — MCP + Hono + polish
- [ ] @tailrace/mcp transport wrapper with JSON-RPC error synthesis on block
- [ ] @tailrace/hono incl. SSE streaming scan; 422 error shape
- [ ] Root README with the 10-line quickstart; per-package READMEs; CHANGELOG via changesets
- [ ] OPEN_QUESTIONS.md triaged: every SPEC-QUESTION either resolved in docs or explicitly deferred

## Demos (must run from fresh clone, commands documented in each example's README)

**Demo 1 — "Your agent just leaked a key."** Next.js route: user prompt contains a fake Stripe key + an email. Console shows the model received `<blocked>`-free input: request aborted with policy violation naming `api_key`; second run with key removed shows email tokenized in the outbound request (log the transformed params) and restored in the UI response.

**Demo 2 — "Claude Code can't paste your secrets."** In examples/claude-code: agent is asked to read `.env.example` (fake values) and POST its contents to httpbin via a fetch tool. Hook denies with reason naming `api_key` and the rule; agent retries with tokenized payload; PostToolUse audit line appears in `.tailrace/audit.jsonl`.

**Demo 3 — "Token stability across 50 steps."** Script drives a 50-step tool loop where the same customer email appears at steps 1, 17, 42 through different boundaries; assert the identical token appears each time and detokenizes correctly at the final `egress` sink. This is also the M2/M3 regression test.
