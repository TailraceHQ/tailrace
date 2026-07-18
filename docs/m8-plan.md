# M8 Implementation Plan: Tier 1 NER (`@tailrace/recognizer-ner`)

> **Status: in progress.** Core async + package decode/ONNX path landed; M8-6 benchmarks open.
> Acceptance: [`milestones.md`](milestones.md) §M8.
> Normative detection: [`detection.md`](detection.md) §3 (revise when taxonomy + model lock).
> Package stub: `packages/recognizer-ner` (throws `NotImplementedError` today).

Post-M7. Ships the optional Tier 1 recognizer behind the existing public interface, with OpenAI Privacy Filter as the leading candidate and GLiNER-class models as the F1-per-MB comparison set.

**Prime directives that apply:** #3 (do not train / chase NER accuracy; commodity model + our policy stack), #4 (fail open to Tier 0 if model missing/throws), #6 (no raw values in fixtures/logs), runtime matrix (Node/Fluid only for Tier 1; edge remains non-goal).

## Candidate model (Privacy Filter)

| Fact | Value |
|---|---|
| Hub | [`openai/privacy-filter`](https://huggingface.co/openai/privacy-filter) |
| License | Apache 2.0 (attribution + NOTICE; no OpenAI trademark in product name) |
| Architecture | Token classification over BIOES labels; constrained Viterbi span decode |
| Size | ~1.5B total params, ~50M active (MoE-style); long context (128k) |
| Categories (8) | `secret`, `account_number`, `private_person`, `private_address`, `private_email`, `private_phone`, `private_url`, `private_date` |
| Official ONNX | Already shipped under `onnx/` (`model.onnx`, `model_fp16.onnx`, `model_quantized.onnx`, `model_q4.onnx`, `model_q4f16.onnx`) |

Community FP16 re-exports also exist; prefer pinning an official revision unless benchmarks require a custom int8 export.

## Explicit non-goals

- Training or fine-tuning the model
- Custom TypeGPU / hand-rolled WebGPU kernels
- Tier 1 on Cloudflare Workers / Vercel Edge / browser (architecture.md runtime matrix)
- Replacing Tier 0 deterministic recognizers
- Claude Code hook / CLI hot path loading Tier 1 (integrations.md already excludes this)

## Phases

### Phase 0: Lock open questions (blocking)

Resolve every item under [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) §Open for M8 before implementation. Do not expand `EntityClass` or rewrite detection.md §3 until the mapping table and default artifact are locked.

### Phase 1: Core async recognizer wiring

Today `packages/core/src/detect/engine.ts` rejects Promise-returning `scan` (tests assert this). Make the engine await async recognizers; keep Tier 0 sync. On Tier 1 throw / disable: one warning, continue with remaining recognizers (fail open). Span merge unchanged.

### Phase 2: ONNX + decode in `@tailrace/recognizer-ner`

1. Pin HF repo + revision; lazy `onnxruntime-node` session on first `scan`; honor `modelPath` / `cacheDir` / `revision`.
2. Tokenize with offset mapping; run session; constrained Viterbi (use model `viterbi_calibration.json` / operating points if present).
3. Map BIOES spans → Tailrace `EntityClass` per locked table; emit UTF-16 `Span` offsets.
4. Unavailable model file → one warning, recognizer disabled, never throw into the host.

### Phase 3: Benchmark + lock default

Compare Privacy Filter (chosen ONNX precision) vs at least one GLiNER-class ONNX candidate on a synthetic / public NER+PII fixture set. Record F1, disk MB, RSS, p50 latency in `OPEN_QUESTIONS.md`. Lock the default download artifact. Update detection.md §3 to match reality (may no longer say "GLiNER-class" exclusively).

### Phase 4: Docs, fixtures, CI

Package README; detection.md §3; optional CI job that skips when model cache absent (or uses a tiny fixture ONNX for smoke). No raw secrets/PII in fixtures.

## Locked decisions (user 2026-07-17)

See [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) §Locked for M8.

| Privacy Filter label | Tailrace class | Default action |
|---|---|---|
| `secret` | `SecretEntityClass` `secret` | `block` (via `defaultPolicy()` like other secrets) |
| `account_number` | `account_number` (new) | `allow` (unset) |
| `private_person` | `person` | `allow` (unset NER) |
| `private_address` | `private_address` (new) | `allow` (unset) |
| `private_email` | `email` | `tokenize` (existing Tier 0 default - document lookup caveat) |
| `private_phone` | `phone` | `tokenize` (existing Tier 0 default) |
| `private_url` | `private_url` (new) | `allow` (unset) |
| `private_date` | `private_date` (new) | `allow` (unset) |

**Policy API (option C):** `nerRecognizer()` does not auto-merge policy. Export
`nerRecommendedPolicy()` (name TBD) as an opt-in fragment users merge. Tier 1 remains opt-in;
F1-per-MB recorded but not sole model-pick criterion.

## Docs checklist (end of M8)

- [x] `docs/detection.md` §3 reflects chosen model + entity mapping
- [ ] `OPEN_QUESTIONS.md`: Tier 1 model choice moved to Resolved with benchmark table (M8-6)
- [x] `packages/recognizer-ner/README.md` quickstart + memory footprint
- [x] Apache NOTICE for Privacy Filter weights (user-supplied; not redistributed)
