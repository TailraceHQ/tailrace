# M6 Implementation Plan: Custom scan patterns

> **Status: complete (M6a-M6e).** Acceptance criteria in [`milestones.md`](milestones.md) §M6 are checked except optional playground Playwright test.
> Normative detection behavior: [`detection.md`](detection.md) §7 (to be added in M6a).
> **Priority queue after M6a core ships:** M6d (CLI declarative regex config), then M6e (playground custom pattern editor).

Post-v0.1 hardening. M0–M5 are complete. This closes the gap between the documented custom-recognizer API and safe, ergonomic regex/pattern helpers for production employee-ID-style entities.

**Uncommitted note:** `apps/web/components/playground.tsx` only expands built-in Tier 0 entity toggles to match `defaultPolicy()`. It does not touch custom recognizers. No conflict with M6a–M6c; M6e builds on top.

---

## Executive summary

Tailrace already supports **custom recognizers** at the API and engine level, but **not** a safe, ergonomic **regex/pattern helper**. Users can hand-write `scan()` today (see `packages/core/src/detect/engine.test.ts`); builtins use internal `scanPatterns` (`packages/core/src/detect/recognizers/shared.ts`) that is **not** exported. There is **no ReDoS defense**, **no recognizer validation**, and **`RecognizerError` is never thrown** despite being in the error taxonomy.

**Recommended delivery:** M6 centered on **`definePatternRecognizer`** wrapping validated, bounded pattern scanning. CLI JSON config (M6d) and playground custom-pattern UI (M6e) follow immediately after core ships.

---

## Locked decisions (pre-flight)

| Topic | Decision |
|---|---|
| Public API | **`definePatternRecognizer`** separate from `defineRecognizer`; do not export internal `scanPatterns` |
| Pattern shape | `patterns: { source: string; confidence?: number }[]`; `confidence` defaults to `0.8` |
| Entity field | Singular `entity` maps to `Recognizer.entities: [entity]` |
| Registration errors | Reuse **`RecognizerError`** (`code: RECOGNIZER`) at `definePatternRecognizer` call; no new error class |
| Built-in entity names | **Forbid** in pattern helper (`SECRET_ENTITY_CLASSES`, `PII_ENTITY_CLASSES`, `NER_ENTITY_CLASSES`) |
| Entity name shape | `^[a-z][a-z0-9_]{0,63}$` |
| Scan budget exceed | **Fail open:** skip recognizer, one `getConsole()` warning; do not throw from `check()` |
| Custom `scan()` throw | Wrap in `RecognizerError`; **skip that recognizer**, continue others |
| Builtin recognizers | Trusted; unchanged fail semantics |
| Max custom recognizers | Default **16** via optional internal `maxCustomRecognizers` |
| Optional `validate()` callback | **Defer** (post-M6e) |
| ReDoS guarantee | **Best-effort** static analysis + runtime bounds; document honestly |
| Versioning | Minor bump **`0.2.0`** when `definePatternRecognizer` exports |

---

## 1. Current spec vs implementation

| Area | Spec | Implementation |
|------|------|----------------|
| Custom recognizer API | `defineRecognizer({...})`; register via `createTailrace({ recognizers })` | `defineRecognizer` is identity passthrough (`packages/core/src/index.ts`) |
| Pattern-based option | "pattern-based or arbitrary `scan`" (`detection.md` §1) | Only arbitrary `scan`; pattern loop duplicated in tests/docs |
| Entity typing | `EntityClass` includes `(string & {})` for user classes | Works |
| Policy integration | Any string key in `entities` map | Custom entities fall through to `defaults.action` = **`allow`** |
| Secret-class rules | Only built-in `SecretEntityClass` values | Custom `employee_id` is **not** secret-class unless user reuses a built-in name |
| Span merge / overlap | `detection.md` §4 | `mergeSpans` + `collapseOverlaps` |
| Object paths | Walk string leaves, RFC 6901 paths | `scanObject` |
| Recognizer failures | `RecognizerError` (`conventions.md`) | Class exists; **engine never catches** |
| Perf budget | Tier 0 4KB p50 < 5ms | `packages/core/tests/perf.test.ts` (builtins only) |
| Public exports | `defineRecognizer` listed (`architecture.md` §6) | `scanPatterns` internal only |

---

## Phase M6a: Core safety + helper (blocking)

**Goal:** `definePatternRecognizer`, regex safety, engine isolation, tests, `detection.md` §7.

- [ ] `packages/core/src/detect/regex-safety.ts` - static pattern validator (max length, no backrefs, nested quantifiers, bounded `{n,m}`, conservative lookbehind rules)
- [ ] `packages/core/src/detect/regex-safety.test.ts` - evil patterns rejected; safe employee-ID patterns accepted
- [ ] `packages/core/src/detect/pattern-recognizer.ts` - `definePatternRecognizer`, compiles validated patterns, returns `Recognizer`
- [ ] `packages/core/src/detect/pattern-recognizer.test.ts` - flags stripped, zero-length, max-matches, Unicode
- [ ] `packages/core/src/detect/pattern-recognizer.property.test.ts` - fast-check bounded scan invariants
- [ ] `packages/core/src/detect/recognizers/shared.ts` - extend with budget/max-match params (internal)
- [ ] `packages/core/src/detect/engine.ts` - try/catch per recognizer; duplicate `id` rejection; per-leaf budget
- [ ] `packages/core/src/index.ts` - export `definePatternRecognizer`; TSDoc on `defineRecognizer` points to pattern helper
- [ ] `packages/core/src/detect/engine.test.ts` - budget skip, error isolation, duplicate id
- [ ] `packages/core/src/index.test.ts` - E2E `EMP-01234` tokenization
- [ ] `packages/core/tests/perf.test.ts` - builtins unchanged; +3 custom patterns still < 5ms p50
- [ ] `packages/core/tests/types/pattern-recognizer.test-d.ts` - expect-type
- [ ] Error grep suite - `RecognizerError` messages contain no matched values
- [ ] `docs/detection.md` §7 - custom pattern recognizers
- [ ] `docs/architecture.md` §6 - add `definePatternRecognizer` to public export list
- [ ] `apps/web/content/docs/reference/errors/RECOGNIZER.mdx` - match fail-open engine behavior

**Exit:** M6a acceptance criteria in [`milestones.md`](milestones.md) green; workerd pool passes new sync tests.

### Regex safety rules (M6a)

| Rule | Rationale |
|------|-----------|
| Max source length (512) | Limit attack surface |
| Reject backreferences (`\1`, `\k<`) | ReDoS + complexity |
| Reject nested quantifiers on groups | Classic ReDoS |
| Cap `{n,m}` with `m > 64` or unbounded on repeated groups | Bounded repetition |
| Reject quantified lookbehind innards (conservative) | Lookbehind ReDoS |
| Allow `\b`, anchors, character classes, `(?:...)` | Employee-ID use cases |

### Controlled execution (M6a)

| Control | Default |
|---------|---------|
| Flags | Force **`gu`**; strip user flags |
| `lastIndex` | Reset to `0` before scan |
| Zero-length matches | `lastIndex++`; max-iterations cap |
| Max matches per pattern per leaf | 256 |
| Wall-clock budget per recognizer per leaf | 2ms |
| Span bounds | `m[0]` only; ignore capturing groups |

---

## Phase M6b: Docs + examples

**Goal:** Guide scaffold, README example, concept cross-links.

- [ ] `apps/web/content/docs/guides/write-custom-recognizers.mdx` - scaffold (listed in `site/information-architecture.md` but missing)
- [ ] `apps/web/content/docs/concepts/detection-tiers.mdx` - link to guide + pattern helper
- [ ] `packages/core/README.md` - employee-ID `definePatternRecognizer` example
- [ ] Root README / quickstart cross-link (if applicable)

**Exit:** docs site builds; guide reachable from Concepts sidebar.

---

## Phase M6c: Benchmark hardening (optional, same PR if small)

- [ ] `benchmarks/harness.mjs` - replace placeholder with `@tailrace/core` `createDetectionEngine().detect()` for real Tier 0 gate

**Exit:** CI perf gate exercises real detection path.

---

## Phase M6d: CLI declarative regex config (UP NEXT)

**Goal:** Declare validated pattern recognizers in `.tailrace/config.json`; hook and `tailrace scan` load them without TS on the hot path.

Depends on M6a (`definePatternRecognizer` + static validation at compile time).

### Locked decisions (M6d)

| Topic | Decision |
|---|---|
| Config version | Bump to **`version: 2`** when `recognizers` present; v1 configs unchanged |
| Hot path | JSON parse only; patterns validated at **`init` / `install-hooks` write time**, not per hook spawn |
| Recognizer shape | Array of `{ id, entity, tier: 0, patterns: [{ source, confidence? }] }` |
| Compilation | Extend `init` + `install-hooks` to accept patterns from `tailrace.config.ts` and emit compiled JSON |
| Policy plane | **Defer** remote sync; local JSON only in M6d |
| Standalone compile | Optional `tailrace compile-config` only if `init`/`install-hooks` DX is insufficient |

### Tasks

- [ ] Extend `CompiledCliConfig` (`packages/cli/src/internal/config.ts`) with optional `recognizers`
- [ ] JSON Schema for compiled config recognizers (extend or sibling schema under `packages/core/schemas/`)
- [ ] `createTailraceFromCompiledConfig` passes `recognizers` through `definePatternRecognizer` at load
- [ ] `tailrace.config.ts` authoring shape documented (patterns array alongside policy)
- [ ] `init` / `install-hooks` compile recognizers into `.tailrace/config.json`
- [ ] `tailrace scan` and `tailrace hook` use compiled recognizers
- [ ] Validation errors at compile time name pattern index + rule; never log pattern source in audit
- [ ] CLI tests: valid config loads; invalid pattern rejected at compile; hook detects custom entity
- [ ] `docs/integrations.md` §4 + CLI reference page - recognizer JSON shape
- [ ] `packages/cli/README.md` - employee-ID config example

**Exit:** M6d acceptance criteria in [`milestones.md`](milestones.md) green.

---

## Phase M6e: Playground custom pattern editor (UP NEXT)

**Goal:** Interactive UI to add/remove custom pattern recognizers and set per-entity policy actions in the docs playground.

Depends on M6a. Does not require M6d (in-browser `definePatternRecognizer` only).

### Locked decisions (M6e)

| Topic | Decision |
|---|---|
| Persistence | **Session-only** (React state); no localStorage in v0.2 |
| Pattern entry | Entity name + regex source + optional confidence; validated via `definePatternRecognizer` |
| Policy | User must set action per custom entity (default UI: `tokenize`); warn if entity has no policy entry |
| Built-in toggles | Keep existing Tier 0 entity toggles; custom patterns are a separate panel |
| Error UX | Registration errors shown inline; never display matched secret-shaped sample values in errors |
| Sample text | Provide optional "insert sample" for employee-ID demo; synthetic values only |

### Tasks

- [ ] Playground panel: add/remove custom patterns (id, entity, source, confidence)
- [ ] Wire `createTailrace({ recognizers, policy })` when patterns or actions change
- [ ] Inline validation errors from `definePatternRecognizer` (catch at add time)
- [ ] Custom entity action dropdown (`allow` / `mask` / `tokenize` / `block`)
- [ ] Decisions list shows custom `entity` + `rule` like builtins
- [ ] Link to `write-custom-recognizers` guide
- [ ] Playwright or component test: add pattern, scan sample, see token in output
- [ ] Do not regress builtin Tier 0 toggle behavior

**Exit:** M6e acceptance criteria in [`milestones.md`](milestones.md) green.

---

## Behavioral matrix (reference)

| Concern | Behavior |
|---------|----------|
| Global / sticky flags | Stripped; engine uses `gu` + controlled loop |
| Zero-length matches | Advance `lastIndex` by 1; max-iterations cap |
| Unicode | `u` forced; UTF-16 offsets |
| Capturing groups | Ignored; full match `m[0]` only |
| Normalization | `trim()` only for custom entities |
| Overlapping spans, same entity | Union in `mergeSpans` |
| Overlapping spans, different entities | Both kept; `collapseOverlaps` picks more restrictive action |
| Object paths | Attached by `scanObject` |
| Streaming `check` | Same detect-on-full-buffer model |
| Audit | `Decision` carries `entity`, `rule`, `contentHash` - **never raw value** |

---

## Unresolved product choices

| Choice | **Recommendation** |
|--------|---------------------|
| New export vs enrich `defineRecognizer` | **`definePatternRecognizer`** |
| Scan budget exceed | **Skip + warn once** |
| Custom `scan()` throw | **Skip recognizer** |
| Allow custom recognizer to emit built-in entity names | **Forbid** in pattern helper |
| Max custom recognizers | **Fixed default 16** |
| Optional `validate()` callback | **Defer** |
| CLI JSON patterns | **M6d** (this plan) |
| Separate `PatternValidationError` | **`RecognizerError`** |
| Fail-closed when `block` entity's recognizer fails | **Document gap**; optional future `detectionFailure: "block"` knob out of scope |

---

## Evidence anchors

```24:24:docs/detection.md
`defineRecognizer({...})` is the public API for custom recognizers (pattern-based or arbitrary `scan`). Registered via `createTailrace({ recognizers: [...] })`.
```

```14:29:packages/core/src/detect/recognizers/shared.ts
export function scanPatterns(
  text: string,
  patterns: readonly Pattern[],
  entity: EntityClass,
  recognizer: string,
): Span[] {
  // zero-length guard at line 26
}
```

```32:58:packages/core/src/detect/engine.test.ts
  it("runs custom recognizers alongside (or instead of) the builtins", () => {
    const employeeId: Recognizer = {
      id: "employee-id",
      entities: ["employee_id"],
      tier: 0,
      scan: (text) => { /* manual /EMP-\d{5}/ loop */ },
    };
```

```48:59:packages/core/src/detect/engine.ts
  const runRecognizers = (text: string): Span[] => {
    for (const recognizer of recognizers) {
      const result = recognizer.scan(text);
      // no try/catch, no RecognizerError
    }
  };
```

---

## Out of scope (M6 overall)

- Format-preserving tokens for custom entities
- Corpus CI gates for user-defined patterns
- Tier 1 async pattern recognizers
- Policy-plane remote sync of recognizer definitions (M6d is local JSON only)
- ReDoS-proof guarantee (best-effort only)
- Optional per-pattern `validate()` callback
- Editing uncommitted `playground.tsx` builtin toggles unless separately requested
