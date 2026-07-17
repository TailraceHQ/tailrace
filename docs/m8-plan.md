# M8 Implementation Plan: Tier 1 NER (`@tailrace/recognizer-ner`)

> **Status: not started.** Acceptance: [`milestones.md`](milestones.md) §M8.
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

## Suggested entity mapping (proposal - not locked)

| Privacy Filter label | Proposed Tailrace class | Notes |
|---|---|---|
| `secret` | new `SecretEntityClass` member `secret` (or map to `high_entropy_secret`) | Must inherit secrets-cannot-allow invariant |
| `account_number` | `credit_card` and/or new NER class | Overlaps Tier 0 Luhn cards; most-restrictive-action already handles overlap |
| `private_person` | `person` | Existing `NerEntityClass` |
| `private_address` | new `location` subtype or keep `location` | Spec only has `location` today |
| `private_email` | `email` | Overlaps Tier 0 |
| `private_phone` | `phone` | Overlaps Tier 0 |
| `private_url` | new class or `allow`/custom | No built-in today |
| `private_date` | new class or drop | No built-in today |

Lock the table in OPEN_QUESTIONS before coding the mapper.

## Docs checklist (end of M8)

- [ ] `docs/detection.md` §3 reflects chosen model + entity mapping
- [ ] `OPEN_QUESTIONS.md`: Tier 1 model choice moved to Resolved with benchmark table
- [ ] `packages/recognizer-ner/README.md` quickstart + memory footprint
- [ ] Apache NOTICE / attribution for Privacy Filter weights if redistributed or pinned by default
