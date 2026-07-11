# Architecture

## 1. Monorepo layout

```
/
├── packages/
│   ├── core/            # @tailrace/core — detection, policy engine, vault, audit emitter
│   ├── ai-sdk/          # @tailrace/ai-sdk — Vercel AI SDK middleware + tool wrapper
│   ├── mcp/             # @tailrace/mcp — MCP client transport wrapper
│   ├── hono/            # @tailrace/hono — Hono middleware (openai-compatible passthrough mode)
│   ├── cli/             # @tailrace/cli — `tailrace` binary: init, install-hooks, hook, scan
│   └── recognizer-ner/  # @tailrace/recognizer-ner — Tier 1 ONNX recognizer (optional peer)
├── apps/
│   └── web/             # @tailrace/web — docs + marketing site (Next.js + Fumadocs); see docs/site/DOCS_AGENTS.md
├── examples/
│   ├── nextjs-ai-sdk/   # Next.js app using @tailrace/ai-sdk (demo 1 & 3)
│   └── claude-code/     # settings.json + walkthrough for hook demo (demo 2)
├── benchmarks/          # perf harness, run in CI
└── docs/                # normative specs: library kit at docs/*.md; site kit at docs/site/
```

Tooling: pnpm workspaces + Turborepo. tsup for builds (ESM + CJS, `.d.ts`). Vitest for tests. Changesets for versioning. TypeScript strict, `exactOptionalPropertyTypes: true`.

## 2. Package dependency rules

- `core` depends on nothing at runtime (zero prod dependencies; dev deps fine). Everything it needs (HMAC, hashing) uses WebCrypto (`globalThis.crypto.subtle`).
- `ai-sdk`, `mcp`, `hono`, `cli` depend on `core` plus their host framework as a **peer dependency** (`ai`, `@modelcontextprotocol/sdk`, `hono`).
- `recognizer-ner` depends on `onnxruntime` packages and is a peer/optional dep of nothing — users install it explicitly and pass it into config. `core` must never import it.
- No package may import from another package's internals — public entry points only. Enforce with eslint `no-restricted-imports`.

## 3. Runtime matrix (CI must test all)

| Package | Node 20+ | Cloudflare Workers (workerd) | Vercel Edge | Browser |
|---|---|---|---|---|
| core | ✅ | ✅ | ✅ | ✅ (best-effort) |
| ai-sdk | ✅ | ✅ | ✅ | — |
| mcp | ✅ | ✅ | — | — |
| hono | ✅ | ✅ | ✅ | — |
| cli | ✅ | — | — | — |
| recognizer-ner | ✅ | ❌ v0.1 | ❌ v0.1 | — |

"✅ for core" means: no `node:` imports, no `Buffer` (use `Uint8Array`/`TextEncoder`), no sync crypto, no filesystem. CI runs the core test suite under `workerd` via `@cloudflare/vitest-pool-workers`.

## 4. Core internal structure

```
core/src/
├── index.ts          # createTailrace(), definePolicy(), public types
├── detect/           # engine registry, tier0 recognizers, span merging
├── policy/           # resolution algorithm (see policy-engine.md)
├── vault/            # Vault interface, memoryVault, kvVault adapter contract
├── actions/          # apply(action, span): mask / tokenize / block / allow
├── audit/            # event types, emitter, sinks (console, otel, jsonl, custom)
└── errors.ts         # typed error taxonomy (see conventions.md)
```

Data flow for any check: `input text/object → detect (spans) → policy resolve (span × boundary × identity → action) → apply actions → { output, decisions[] } → audit emit (async)`.

Objects (tool args, JSON messages) are scanned by walking string leaves; the span carries a JSON path so actions rewrite in place. Never serialize an object to one big string for scanning (breaks offsets, wrecks perf).

## 5. Policy plane client interface (design only — no server in v0.1)

`core` exposes a `PolicySource` interface so a hosted plane can slot in later without API changes:

```ts
interface PolicySource {
  load(): Promise<PolicyDocument>;        // called at init / cold start
  subscribe?(cb: (p: PolicyDocument) => void): () => void; // optional hot reload
}
```

v0.1 ships `staticPolicy(doc)` (the default; wraps a local `definePolicy` result) and `fileP olicy(path)` (Node only, for the CLI). A future `remotePolicy(url, key)` is out of scope but must be implementable against this interface with no core changes. Audit sinks follow the same pattern: `AuditSink` interface, local sinks shipped, remote sink later.

## 6. Public API surface (top-level exports of @tailrace/core)

`createTailrace`, `definePolicy`, `defineRecognizer`, `memoryVault`, `kvVault`, `staticPolicy`, error classes, and all public types. Anything else is internal. Keep this list short — every export is API we maintain forever.
