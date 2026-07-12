# M3 Implementation Plan: @tailrace/ai-sdk

> **Status: complete.** Acceptance criteria in [`milestones.md`](milestones.md) §M3 are checked off. This file is retained as the historical build plan; normative runtime behavior lives in [`integrations.md`](integrations.md) §1 and [`policy-engine.md`](policy-engine.md) §5. User-facing walkthrough: [`guides/ai-sdk-integration.md`](guides/ai-sdk-integration.md).

Normative acceptance criteria: [`milestones.md`](milestones.md) §M3. Integration mechanics: [`integrations.md`](integrations.md) §1. Build strictly in the order below; each phase should be green in CI before starting the next.

## Locked decisions (pre-flight)

| Topic | Decision |
|---|---|
| Public API | **Option C**: `wrapModel` / `wrapTools` + `withAiSdk()` fluent helper |
| AI SDK pin | **`ai@^5`** peer; bind types against installed middleware |
| Model boundary | `{ kind: "model", provider }` for **input and output** (not `telemetry`) |
| Provider encoding | `${providerId}/${modelId}`; gateway-style `modelId` with `/` used as-is |
| Output block (generate) | Post-hoc scan; throw `PolicyViolationError` |
| Output block (stream) | User-selectable `streamBlockBehavior`: `abort` (default), `buffer`, `redact` |
| Demo 1 provider | Mock model in CI; optional live provider behind env var |
| Demo 1 block semantics | Secret never reaches provider; abort before call (not a `<blocked>` placeholder) |
| Egress restore | Explicit `tailrace.restore(..., { kind: "egress", sink: "ui" })` in route handler |

---

## Phase 0: Dependencies and types scaffold

**Goal:** `@tailrace/ai-sdk` compiles against real `ai@^5` types; no runtime behavior yet.

1. Add devDependencies to `packages/ai-sdk`: `ai@^5`, `@ai-sdk/provider` (if needed for types), `vitest`, `expect-type`.
2. Update `peerDependencies` to `"ai": "^5"`.
3. Read installed `ai` middleware source (`wrapLanguageModel`, `LanguageModelMiddleware`, message/part types). Record any drift from this plan in `integrations.md`.
4. Replace generic `TModel` / `TTools` stubs with real `LanguageModel` / `ToolSet` imports from `ai`.
5. Export public types: `AiSdkWrapOptions`, `StreamBlockBehavior`, `TailraceWithAiSdk`.

**Exit:** `pnpm --filter @tailrace/ai-sdk typecheck` green.

---

## Phase 1: Core: `applyBlockAs` for stream redact

**Goal:** Support `streamBlockBehavior: "redact"` without policy logic in the integration.

1. Add optional `CheckOptions` to `@tailrace/core`:

   ```ts
   interface CheckOptions {
     /** When policy resolves to block, apply this action instead of throwing. Integration-only; default throw. */
     applyBlockAs?: "mask";
   }
   ```

2. Thread through `Tailrace.check` signature (optional third arg or `ctx` extension - prefer third arg to keep `CheckContext` pure).

3. In `applyActions`: when `applyBlockAs: "mask"` and action is `block`, apply `mask` instead of throwing. Audit `Decision` keeps `action: "block"` and adds optional `appliedAs: "mask"`.

4. Unit tests: block + `applyBlockAs: "mask"` → `[EMAIL]` output, decision records both fields. Default (no option) still throws.

5. Update `docs/policy-engine.md` §5.

**Exit:** core tests + workerd pool green.

---

## Phase 2: Shared integration helpers

**Goal:** DRY boundary/identity/context construction used by model + tools + stream transforms.

Create `packages/ai-sdk/src/internal/` (not exported):

| Module | Responsibility |
|---|---|
| `context.ts` | Build `CheckContext` from opts + boundary; resolve `workflowId` fn |
| `provider.ts` | `encodeModelProvider(model)` → `openai/gpt-4o` |
| `messages.ts` | Walk AI SDK message/part tree; extract text leaves with JSON-pointer paths; rewrite in place |
| `errors.ts` | `formatToolBlockError`, re-export `PolicyViolationError` translation |
| `audit.ts` | Forward `onDecision` + gate audit sinks |

**Exit:** unit tests for `encodeModelProvider` (combined, gateway-style, fallback) and message walk/rewrite on fixture message arrays.

---

## Phase 3: `wrapModel` middleware

**Goal:** `transformParams`, `wrapGenerate`, `wrapStream` wired end-to-end.

### 3a: `transformParams`

- Scan all text parts in `params` (prompt/messages).
- `tailrace.check(messagesObject, { boundary: { kind: "model", provider }, ... })`.
- Return rewritten params.
- Test: fake Stripe key in user message → throws; email → tokenized in params.

### 3b: `wrapGenerate`

- Await `doGenerate()`, extract output text from result.
- `check` output string at model boundary.
- Rewrite or throw.
- Test: mock model returning secret → throws; returning email echo → tokenized.

### 3c: `wrapStream` (three transforms)

| File | Mode |
|---|---|
| `stream/abort.ts` | Hold-back + carry; throw on block |
| `stream/buffer.ts` | Collect all chunks; check at end; throw on block |
| `stream/redact.ts` | Hold-back; `check(..., { applyBlockAs: "mask" })` on block spans |
| `stream/index.ts` | Dispatch on `streamBlockBehavior`; shared carry-buffer constants |

Carry buffer size: max Tier 0 matchable span length (derive from detection constants or conservative fixed cap, document in code).

Adversarial tests:

- 1-char chunks through each mode
- Chunk split mid `<EMAIL_` token (tokenize path)
- Chunk split mid `sk_test_` (block path)
- `redact` mode: stream completes, output contains `[API_KEY]`, no raw secret

### 3d: `wrapModel` assembly

- `wrapLanguageModel({ model, middleware: tailraceMiddleware })`.
- Export `wrapModel(tailrace, model, opts)`.

**Exit:** ai-sdk unit tests green; no example app yet.

---

## Phase 4: `wrapTools`

**Goal:** Type-preserving tool wrapper.

1. Iterate tool entries; skip tools without `execute`.
2. Wrap `execute`: check args (out), call original, check result (in).
3. Tool block → catch `PolicyViolationError`, return/throw formatted tool error string per integrations.md §1.3.
4. `expect-type` tests: wrapped tool infers same args/result as unwrapped.

Export `wrapTools(tailrace, tools, opts)`.

**Exit:** type tests + unit tests green.

---

## Phase 5: Fluent API (`withAiSdk`)

**Goal:** Option C without core importing `ai`.

```ts
export interface TailraceWithAiSdk extends Tailrace {
  model(model: LanguageModel, opts?: AiSdkWrapOptions): LanguageModel;
  tools<T extends ToolSet>(tools: T, opts?: AiSdkWrapOptions): T;
}

export function withAiSdk(tailrace: Tailrace): TailraceWithAiSdk {
  return Object.assign(tailrace, {
    model: (m, o) => wrapModel(tailrace, m, o),
    tools: (t, o) => wrapTools(tailrace, t, o),
  });
}
```

Update root README quickstart to use `withAiSdk(createTailrace()).model(...)`.

Remove or update `// SPEC-QUESTION` comments in `packages/ai-sdk/src/index.ts`.

**Exit:** build + lint green; README accurate.

---

## Phase 6: Demo 3 regression test (ai-sdk package)

**Goal:** Milestones Demo 3 spec in integration tests (extends core's 50-step test).

Script or vitest test:

- 50-step loop; email at steps 1, 17, 42 via `wrapModel` transformParams, `wrapTools` execute out, and mixed boundaries.
- Assert identical token at all three checkpoints and all 50 steps.
- Final `tailrace.restore` at `{ kind: "egress", sink: "ui" }` → original email.

Keep existing core test; this test proves the **wrappers** preserve token stability.

**Exit:** test in `packages/ai-sdk/src/` or `examples/nextjs-ai-sdk/scripts/demo-3.ts` runnable via documented command.

---

## Phase 7: `examples/nextjs-ai-sdk`

**Goal:** Demos 1 & 3 runnable from fresh clone.

### App structure

```
examples/nextjs-ai-sdk/
├── README.md          # documented commands
├── package.json       # workspace dep on @tailrace/core, @tailrace/ai-sdk, ai, next
├── app/
│   ├── page.tsx       # simple UI: prompt input, response display
│   └── api/chat/route.ts
└── scripts/
    └── demo-3.ts      # 50-step token stability (or pnpm test in example)
```

### Demo 1 route behavior

1. **Run A (block):** User prompt with fake `sk_test_...FAKE` + email → `PolicyViolationError` → 422/400 to UI with entity `api_key` in error body (no raw key in response or logs).
2. **Run B (tokenize + restore):** Prompt with email only → log transformed params (email tokenized) → mock model echoes input → route calls `tailrace.restore(..., egress: "ui")` before returning → UI shows real email.

**Mock model:** Default for CI (`DEMO_LIVE=1` optional for real provider). Mock implements `LanguageModel` / works with `wrapLanguageModel`.

**workflowId:** per-request UUID from header or cookie (document in README).

### README commands

```bash
pnpm install
pnpm --filter example-nextjs-ai-sdk dev        # Demo 1 interactive
pnpm --filter example-nextjs-ai-sdk demo:3     # Demo 3 script
```

Wire example into pnpm workspace (`pnpm-workspace.yaml`).

**Exit:** Demos run from clean clone per milestones.md.

---

## Phase 8: CI and docs polish

1. `@tailrace/ai-sdk` tests in turbo `test` pipeline (currently `--passWithNoTests`).
2. eslint boundary: ai-sdk imports only `@tailrace/core` public API + `ai`.
3. Update `packages/ai-sdk/README.md` (≤ 10 line quickstart, both API forms, `streamBlockBehavior` table).
4. Promote M3 locked items in `OPEN_QUESTIONS.md` to Resolved.
5. Check off M3 boxes in `milestones.md` when green.
6. **Docs site (M3):** quickstart, protect-pii guide, reference/ai-sdk/*, integrations/nextjs - see `apps/web/content/docs/`.

---

## File map (expected new/changed)

```
packages/core/src/
  types.ts              # CheckOptions, Decision.appliedAs
  actions/apply.ts        # applyBlockAs
  index.ts                # check(..., options?)

packages/ai-sdk/src/
  index.ts                # public exports
  wrap-model.ts
  wrap-tools.ts
  fluent.ts               # withAiSdk
  internal/
    context.ts
    provider.ts
    messages.ts
    errors.ts
    audit.ts
  stream/
    index.ts
    abort.ts
    buffer.ts
    redact.ts
    carry-buffer.ts
  *.test.ts
  wrap-tools.test-d.ts    # expect-type

examples/nextjs-ai-sdk/   # full app

docs/
  integrations.md         # updated (this PR)
  policy-engine.md        # CheckOptions
  m3-plan.md              # this file
  milestones.md           # Demo 1 wording fix
```

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| AI SDK v5 middleware API differs from docs | Phase 0: read installed source first; update integrations.md same PR |
| Message part tree changes between providers | Scan only text parts; skip unknown part types with debug warn |
| Stream hold-back adds latency | Document tradeoff; default `abort` balances safety + UX |
| `redact` confused with fail-closed | README warning; audit `appliedAs` field |
| Example app CI flakiness | Mock model default; no network in CI |

---

## Out of scope (M3)

- `@tailrace/mcp`, `@tailrace/hono`, `@tailrace/cli` (M4/M5)
- Tier 1 NER in middleware path
- Image/audio part scanning
- `review` action
- emit-then-scan streaming mode (intentionally unsupported)
