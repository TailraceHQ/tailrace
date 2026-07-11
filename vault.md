# Vault & Tokenization Spec

Tokenization is reversible masking with **workflow-scoped determinism**: the same value yields the same token at every step of one workflow, and detokenization happens only at trusted egress.

## 1. Token derivation

```
tokenId = base32(HMAC-SHA256(workflowKey, entityClass || 0x00 || normalizedValue))[0..8]
token   = `<${LABEL}_${tokenId}>`        // e.g. <EMAIL_a3f2k9qx>
```

- `workflowKey = HMAC-SHA256(masterKey, workflowId)` — master key from `createGate({ vault: { key } })` or `GATE_VAULT_KEY` env; if absent, a random per-process key is generated and a one-line notice logged (tokens then don't survive restarts — fine for dev, documented).
- `normalizedValue`: trim; lowercase for `email`; digits-only for `phone`/`credit_card`. Normalization map is per-entity and documented.
- Determinism is per `(workflowId, entityClass, value)`. No workflowId ⇒ workflowId = "default".
- All crypto via WebCrypto. No Node `crypto` imports in core.

## 2. Vault storage

```ts
interface Vault {
  put(e: { workflowId: string; token: string; entity: EntityClass; value: string; expiresAt?: number }): Promise<void>;
  get(workflowId: string, token: string): Promise<{ value: string; entity: EntityClass } | null>;
  purge(workflowId: string): Promise<void>;
}
```

Ships: `memoryVault()` (Map + TTL sweep; default) and `kvVault(kv)` where `kv` is a minimal `{ get(key): Promise<string|null>; put(key, value, opts?: { expirationTtl }): Promise<void>; delete(key) }` — structurally compatible with Cloudflare KV and adaptable to Upstash/Vercel KV/ioredis with 5-line shims (ship the shims in docs, not code). Storage keys: `gate:v1:{workflowId}:{token}`. **Values stored encrypted**: AES-256-GCM with a key derived `HMAC(masterKey, "storage")`, random IV per entry, so a leaked KV namespace doesn't leak PII. Default TTL 24h, configurable.

## 3. Format-preserving mode

Per-entity opt-in (`format: "preserve"`). v0.1 supports:
- `credit_card`: preserve BIN-length shape, regenerate digits deterministically from tokenId, force Luhn-valid, keep original grouping. Prefix with test-range `9` first digit to guarantee it's not a real PAN.
- `email`: `{tokenId}@redacted.example` (valid RFC address, reserved domain).
- `phone`: `+1555{7 digits from tokenId}` (555 fictional range).
Everything else falls back to `<LABEL_id>` with a compile-time warning. The tokenId → digits mapping must be deterministic and collision-checked against the vault on write.

## 4. Detokenization (`gate.restore`)

- Scans input for token patterns (`<LABEL_[a-z0-9]{8}>` plus the three format-preserving shapes, which are detected via vault lookup of recomputed ids).
- Only runs when boundary kind is `egress` and the sink's policy says `detokenize` (policy-engine.md §3.5 invariant).
- Unknown token (not in vault / expired): leave as-is, emit audit decision `{ action: "restore_miss" }`. Never throw — expired tokens in old transcripts are normal.
- Restores right-to-left by offset.

## 5. Streaming note (for @gate/ai-sdk)

Model output arrives in chunks; tokens can split across chunk boundaries. The stream transform keeps a carry buffer of `maxTokenLength - 1` chars: emit everything except the tail that could be a token prefix, scan on each append, flush carry on stream end. Same carry technique applies to output-side detection. Test with adversarial chunkings (1-char chunks; chunk boundary mid-token).

## 6. Tests that must exist

- Same value, same workflow, 50 sequential `check` calls across model+tool boundaries ⇒ identical token every time (this is Demo 3).
- Different workflows ⇒ different tokens for same value.
- Restore round-trip incl. format-preserving shapes.
- Encrypted-at-rest verified by reading raw KV in test and asserting ciphertext.
- Hard invariant: `restore` at a `model`/`tool`/`mcp`/`telemetry` boundary throws `InvariantViolationError` even if policy is misconfigured to request it.
