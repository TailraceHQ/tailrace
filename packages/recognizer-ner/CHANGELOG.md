# @tailrace/recognizer-ner

## 0.2.0

### Minor Changes

- M8: ship the Tier 1 `nerRecognizer()` (Privacy Filter ONNX, BIOES Viterbi decode) in
  `@tailrace/recognizer-ner`, replacing the `NotImplementedError` stub. `@tailrace/core`'s
  detection engine now awaits async (Tier 1) recognizers while keeping Tier 0 recognizers
  fully synchronous on the hot path.

### Patch Changes

- Updated dependencies
  - @tailrace/core@0.2.3

## 0.1.3

### Patch Changes

- Add a cross-package navigation banner (docs + npm links) to every package README, expand the core README with a package table and quickstart, and point each package.json `homepage` at tailrace.dev.
- Updated dependencies
  - @tailrace/core@0.2.2

## 0.1.2

### Patch Changes

- Add `repository`, `homepage`, and `bugs` package.json fields so npm shows GitHub links on each package page.
- Updated dependencies
  - @tailrace/core@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies
  - @tailrace/core@0.2.0

## 0.1.0

### Minor Changes

- Initial v0.1 release: in-process detection, policy engine, vault, audit, and integrations for AI SDK, MCP, Hono, and Claude Code CLI.

### Patch Changes

- Updated dependencies
  - @tailrace/core@0.1.0
