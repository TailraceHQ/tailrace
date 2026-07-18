# @tailrace/core

## 0.2.3

### Patch Changes

- M8: ship the Tier 1 `nerRecognizer()` (Privacy Filter ONNX, BIOES Viterbi decode) in
  `@tailrace/recognizer-ner`, replacing the `NotImplementedError` stub. `@tailrace/core`'s
  detection engine now awaits async (Tier 1) recognizers while keeping Tier 0 recognizers
  fully synchronous on the hot path.

## 0.2.2

### Patch Changes

- Add a cross-package navigation banner (docs + npm links) to every package README, expand the core README with a package table and quickstart, and point each package.json `homepage` at tailrace.dev.

## 0.2.1

### Patch Changes

- Add `repository`, `homepage`, and `bugs` package.json fields so npm shows GitHub links on each package page.

## 0.2.0

### Minor Changes

- Release `tailrace create` scaffolding and the M7 adapter/openai-agents/cloudflare-agents integrations together, keeping the CLI's template-pinned dependency versions aligned.

## 0.1.0

### Minor Changes

- Initial v0.1 release: in-process detection, policy engine, vault, audit, and integrations for AI SDK, MCP, Hono, and Claude Code CLI.
