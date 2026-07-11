# Detection Spec

Detection produces spans; it never decides actions. Engines are pluggable behind one interface.

## 1. Recognizer interface

```ts
interface Recognizer {
  id: string;
  entities: EntityClass[];                 // what it can emit
  tier: 0 | 1 | 2;
  scan(text: string): Span[] | Promise<Span[]>;  // Tier 0 MUST be sync
}

interface Span {
  entity: EntityClass;
  start: number;   // UTF-16 code unit offsets into the input string
  end: number;
  confidence: number;   // Tier 0 emits 1.0 for validator-confirmed, 0.8 for pattern-only
  recognizer: string;   // id
}
```

`defineRecognizer({...})` is the public API for custom recognizers (pattern-based or arbitrary `scan`). Registered via `createTailrace({ recognizers: [...] })`.

## 2. Tier 0 (ships in core, zero deps, sync)

Implement ALL of the following. Each has (a) a pattern, (b) where applicable a validator that upgrades confidence to 1.0, (c) fixture tests with ≥10 true positives and ≥10 hard negatives.

**Secrets**
- `api_key`: known-prefix patterns — `sk-`, `sk-ant-`, `sk_live_`/`sk_test_` (Stripe), `ghp_`/`gho_`/`github_pat_`, `AKIA[0-9A-Z]{16}` (AWS, validator: charset+length), `xox[bpars]-` (Slack), `AIza` (Google), `key-`/`SG.` (Mailgun/SendGrid), `glpat-` (GitLab), `npm_` (npm), `dop_v1_` (DO), `pk_live_` treated as `api_key` low-confidence.
- `jwt`: three base64url segments `eyJ...`; validator decodes header, checks `alg`/`typ`.
- `private_key`: PEM blocks `-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----`.
- `high_entropy_secret`: strings 20–64 chars, charset ≥ base62, Shannon entropy > 4.0 bits/char, AND context gate: only within 40 chars after a keyword match (`secret|token|password|passwd|pwd|apikey|api_key|auth|credential|bearer`) or inside a quoted assignment. The context gate is mandatory — entropy alone false-positives on hashes, IDs, and base64 payloads.
- `connection_string`: URI schemes `postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp` with `user:pass@` userinfo; also `Server=...;Password=...` ADO style.

**Structured PII**
- `email`: pragmatic RFC-lite pattern; validator checks TLD length ≥ 2.
- `phone`: E.164 and common US/EU formats; require ≥ 7 digits and boundary/context to avoid matching arbitrary number runs; confidence 0.8 unless `+` country prefix (1.0).
- `credit_card`: 13–19 digit runs with optional space/dash grouping; validator: Luhn ⇒ 1.0, else drop the span entirely (do not emit non-Luhn).
- `iban`: country-code pattern + mod-97 validator.
- `ssn`: `\d{3}-\d{2}-\d{4}` plus area/group rules (no 000/666/9xx area); unformatted 9-digit only with context keyword (`ssn|social`).
- `ip_address`: v4 + v6; exclude private/reserved ranges by default (config flag `includePrivateIps`).
- `url_credentials`: any URL containing userinfo (`scheme://user:pass@host`).

## 3. Tier 1 (@tailrace/recognizer-ner, Node/Fluid only)

Wraps a quantized GLiNER-class ONNX model via `onnxruntime-node`. Emits `person`, `location`, `organization`. Requirements: lazy model load on first scan (never at import); model fetched from HF hub URL pinned by revision + local cache dir, or supplied via `modelPath`; async `scan`; batch inputs internally; document memory footprint. If the model file is unavailable at runtime: log one warning, mark recognizer disabled, continue with Tier 0 (prime directive #4). Model choice is a build-time decision — put candidates and benchmark results in `OPEN_QUESTIONS.md`, pick the best F1-per-MB, don't agonize.

## 4. Span merging (in core, after all recognizers run)

1. Drop spans below per-entity confidence thresholds (config, default 0.6).
2. Overlapping spans, same entity → union.
3. Overlapping spans, different entities → keep both; policy layer applies most-restrictive-action rule (policy-engine.md §3.4).
4. Output sorted by `start`; rewriting applies right-to-left so offsets stay valid.

## 5. Object scanning

`check()` accepts JSON objects: walk string leaves (depth limit 32, cycle-safe), scan each, spans carry `path` (RFC 6901 JSON Pointer). Keys are scanned too (a secret can be a key). Non-string leaves ignored in v0.1.

## 6. Perf & quality gates (CI)

- Tier 0 full-suite scan of a 4KB mixed fixture: p50 < 5ms, p99 < 15ms (Node CI runner; benchmark harness in /benchmarks).
- Corpus tests: `fixtures/positives/*.txt` and `fixtures/negatives/*.txt` per entity; recall ≥ 0.95 on positives, precision ≥ 0.95 on negatives for Tier 0 classes. All fixture values must be synthetic/fake.
