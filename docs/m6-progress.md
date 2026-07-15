# M6 Custom Scan Patterns - Progress Tracker

Living checklist for [m6-plan.md](m6-plan.md). Update this file as phases land in CI.

**Last updated:** 2026-07-15  
**Overall:** complete (M6a-M6e); playground E2E test deferred

| Phase | Focus | Status | Blocked by |
|-------|--------|--------|------------|
| **M6a** | Core: `definePatternRecognizer`, ReDoS guards, engine isolation | complete | - |
| **M6b** | Docs: guide, README, concept links | complete | M6a |
| **M6c** | Benchmark harness (real detection) | complete | M6a |
| **M6d** | **CLI declarative regex config** | complete | M6a |
| **M6e** | **Playground custom pattern editor** | complete (no Playwright yet) | M6a |

---

## M6a - Core (100%)

### New modules
- [x] `regex-safety.ts` + tests
- [x] `pattern-recognizer.ts` + unit tests
- [x] `pattern-recognizer.property.test.ts`

### Engine + exports
- [x] `recognizers/shared.ts` - budget / max-match controls
- [x] `engine.ts` - try/catch, duplicate id, budget skip + warn
- [x] `index.ts` - export `definePatternRecognizer`

### Integration tests
- [x] `engine.test.ts` extensions
- [x] `index.test.ts` E2E tokenization
- [x] `perf.test.ts` regression (+3 custom patterns)
- [x] `pattern-recognizer.test-d.ts`
- [x] Error grep - no raw values in `RecognizerError`
- [x] Workerd pool green

### Spec / site
- [x] `docs/detection.md` §7
- [x] `docs/architecture.md` export list
- [x] `RECOGNIZER.mdx` fail-open semantics

---

## M6b - Docs (100%)

- [x] `write-custom-recognizers.mdx`
- [x] `detection-tiers.mdx` cross-link
- [x] `packages/core/README.md` example

---

## M6c - Benchmark (100%)

- [x] `benchmarks/harness.mjs` real `createDetectionEngine().detect()` via `dist/detect/index.js`

---

## M6d - CLI declarative regex (100%)

- [x] `CompiledCliConfig` v2 + `recognizers` array
- [x] `compileRecognizersFromConfig` + validation
- [x] `createTailraceFromConfig` wires recognizers
- [x] `tailrace.config.ts` authoring comments
- [x] `scan` + `hook` load compiled recognizers
- [x] CLI tests (compile validation, v2 config)
- [x] `packages/cli/README.md` + guide docs

---

## M6e - Playground editor (95%)

- [x] Custom patterns panel (add/remove)
- [x] `definePatternRecognizer` inline validation UX
- [x] Per-custom-entity policy action control
- [x] Decisions list shows custom entities
- [x] Guide link from playground
- [ ] Playwright/component test: add pattern, scan, token in output
- [x] Builtin Tier 0 toggles unchanged

---

## Acceptance criteria mirror

See [`milestones.md`](milestones.md) §M6 for CI-gated checkboxes.

---

## Deferred beyond M6

Tracked in [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) §Deferred:

- Optional per-pattern `validate()` callback
- Policy-plane remote sync of recognizer definitions
- Playground pattern persistence (localStorage / share URL)
- `tailrace compile-config` standalone command (only if init/install-hooks DX fails)
- Playground automated E2E test
