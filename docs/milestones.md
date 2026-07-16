# Milestones & Acceptance Criteria

Strict order. A milestone is done when every checkbox passes in CI from a clean clone.

## M0: Repo skeleton
- [x] pnpm + Turborepo monorepo with all packages from architecture.md §1 stubbed (types + `NotImplementedError` bodies)
- [x] tsup builds ESM+CJS+dts for every package; `pnpm build` green
- [x] Vitest wired incl. workers pool for core; `pnpm test` green (empty suites fine)
- [x] eslint + prettier + no-restricted-imports boundary rule; CI workflow runs build/test/lint/bench on PR
- [x] benchmarks/ harness runs a placeholder benchmark and enforces a threshold (proves the perf-gate mechanism)

## M1: Detection (Tier 0)
- [x] All Tier 0 recognizers from detection.md §2 with validators
- [x] Fixture corpus per entity (synthetic values only); precision/recall gates ≥ 0.95 enforced in CI
- [x] Span merging per detection.md §4; object scanning per §5
- [x] Perf gate: 4KB fixture p50 < 5ms in CI benchmark
- [x] Core bundle size gate: < 60KB gzipped, enforced in CI

## M2: Policy engine + vault
- [x] `definePolicy` with full typing + runtime validation; resolution algorithm per policy-engine.md §3 with property-based tests (fast-check) over rule precedence
- [x] Secrets-cannot-be-allowed rule + `dangerouslyAllowSecrets` escape hatch
- [x] `tailrace.check` and `tailrace.restore` end-to-end; actions incl. format-preserving tokenization
- [x] memoryVault + kvVault with encrypted-at-rest test (vault.md §6 complete)
- [x] Audit emitter with console + JSONL sinks; every decision carries rule path + contentHash, zero raw values (test greps audit output for fixture values)
- [x] Default zero-config policy works: `createTailrace()` blocks a Stripe key, tokenizes an email
- [x] Core suite passes under workerd

## M3: AI SDK integration

Implementation plan: [`m3-plan.md`](m3-plan.md).

- [x] `wrapModel` + `withAiSdk().model()` - `transformParams` + `wrapGenerate` + `wrapStream` per integrations.md §1
- [x] Streaming: carry-buffer + three `streamBlockBehavior` modes (`abort` default, `buffer`, `redact`); adversarial chunking tests (1-char chunks, split tokens, split secrets)
- [x] `wrapTools` + `withAiSdk().tools()` with exact type preservation (type-level tests via expect-type)
- [x] Core `check` `applyBlockAs: "mask"` for stream redact mode (policy-engine.md §5)
- [x] `ai@^5` peer dependency; provider encoding `${providerId}/${modelId}`
- [x] examples/nextjs-ai-sdk runs Demos 1 & 3 (below)

## M4: Claude Code CLI

Implementation plan: [`m4-plan.md`](m4-plan.md). User guide: [`guides/block-secrets-in-claude-code.md`](guides/block-secrets-in-claude-code.md).

- [x] `tailrace init`, `tailrace scan`, `tailrace install-hooks` (non-destructive settings merge with backup), `tailrace hook`
- [x] Hook handler meets the output contract in integrations.md §4 - verified against the live Claude Code hooks reference at implementation time (update the doc if it drifted)
- [x] Hook p50 < 150ms measured in CI (spawn-to-exit on a representative tool_input)
- [x] examples/claude-code walkthrough runs Demo 2

## M5: MCP + Hono + polish

Implementation plan: [`m5-plan.md`](m5-plan.md). Guides: [`guides/mcp-integration.md`](guides/mcp-integration.md), [`guides/hono-integration.md`](guides/hono-integration.md).

- [x] @tailrace/mcp transport wrapper with JSON-RPC error synthesis on block
- [x] @tailrace/hono incl. SSE streaming scan; 422 error shape
- [x] Root README with the 10-line quickstart; per-package READMEs; CHANGELOG via changesets
- [x] OPEN_QUESTIONS.md triaged: every SPEC-QUESTION either resolved in docs or explicitly deferred

## M6: Custom scan patterns (post-v0.1)

Implementation plan: [`m6-plan.md`](m6-plan.md). Progress scratchpad: [`m6-progress.md`](m6-progress.md).

- [x] `definePatternRecognizer` with static regex validation and bounded `scanPatterns` execution
- [x] Engine fail-open isolation for custom recognizers; duplicate `id` rejection; `RecognizerError` at registration
- [x] Policy + tokenization path for user-declared custom entity classes (trim-only normalization; label tokens)
- [x] Tests: unit, property (fast-check), e2e, perf regression (+3 custom patterns), workerd
- [x] `docs/detection.md` §7 + `write-custom-recognizers` guide + `RECOGNIZER` error doc aligned with fail-open behavior

### M6d: CLI declarative regex config (priority after M6a)

- [x] `.tailrace/config.json` v2 supports compiled `recognizers` array; validated at load time
- [x] `tailrace scan` and `tailrace hook` load custom patterns from compiled config (no TS on hot path)
- [x] CLI tests + docs for JSON recognizer shape

### M6e: Playground custom pattern editor (priority after M6a)

- [x] Playground UI to add/remove custom patterns and set per-entity actions (session state)
- [x] Inline validation via `definePatternRecognizer`; decisions list shows custom entities
- [ ] Test coverage for add-pattern → scan → token output flow

## M7: Adapter + OpenAI Agents + Cloudflare Agents

Implementation plan: [`m7-plan.md`](m7-plan.md). Guides: [`guides/openai-agents-integration.md`](guides/openai-agents-integration.md), [`guides/cloudflare-agents-integration.md`](guides/cloudflare-agents-integration.md).

### M7a: `@tailrace/adapter`

- [x] `wrapToolExecute`, `runGoverned`, `asCheckable` / `unwrapCheckable`, `formatToolBlockError`
- [x] Zero host peers; Node + workerd; unit + expect-type tests
- [x] `@tailrace/ai-sdk` `wrapTools` may consume adapter public API (behavior unchanged)

### M7b: `@tailrace/openai-agents`

- [x] `wrapTools` / `wrapTool` for `@openai/agents` function tools via adapter
- [x] Fluent `withOpenAiAgents`; Option C public API; type preservation
- [x] Hosted tools documented as out of scope; model wrap deferred

### M7c: `@tailrace/cloudflare-agents` (Compose)

- [x] `createCloudflareTailrace` + DO identity / `kvVault` helpers
- [x] `withCloudflareAgents(tr).forChat` composing `@tailrace/ai-sdk` wraps (no streaming reimplementation)
- [x] `wrapOnToolCall` for client tools; workerd tests green

## Demos (must run from fresh clone, commands documented in each example's README)

**Demo 1: "Your agent just leaked a key."** Next.js route: user prompt contains a fake Stripe key + an email. Run A: request aborted with `PolicyViolationError` naming `api_key` - the secret never reaches the provider (mock model default in CI). Run B: key removed, email tokenized in outbound params (log transformed params), mock model echoes, route calls `tailrace.restore` at egress `ui` before responding - UI shows the real email.

**Demo 2: "Claude Code can't paste your secrets."** In examples/claude-code: agent is asked to read `.env.example` (fake values) and POST its contents to httpbin via a fetch tool. Hook denies with reason naming `api_key` and the rule; agent retries with tokenized payload; PostToolUse audit line appears in `.tailrace/audit.jsonl`.

**Demo 3: "Token stability across 50 steps."** Script drives a 50-step tool loop where the same customer email appears at steps 1, 17, 42 through different boundaries; assert the identical token appears each time and detokenizes correctly at the final `egress` sink. This is also the M2/M3 regression test.
