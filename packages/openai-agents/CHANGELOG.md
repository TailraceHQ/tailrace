# @tailrace/openai-agents

## 0.2.1

### Patch Changes

- Add `repository`, `homepage`, and `bugs` package.json fields so npm shows GitHub links on each package page.
- Updated dependencies
  - @tailrace/core@0.2.1
  - @tailrace/adapter@0.2.1

## 0.2.0

### Minor Changes

- Release `tailrace create` scaffolding and the M7 adapter/openai-agents/cloudflare-agents integrations together, keeping the CLI's template-pinned dependency versions aligned.
- 2e71587: M7: shared `@tailrace/adapter`, OpenAI Agents function-tool wraps, and Cloudflare Agents Compose helpers (via `@tailrace/ai-sdk`).

### Patch Changes

- Updated dependencies
- Updated dependencies [2e71587]
  - @tailrace/core@0.2.0
  - @tailrace/adapter@0.2.0

## 0.1.0

### Minor Changes

- Initial release: `wrapTool` / `wrapTools` and fluent `withOpenAiAgents` for `@openai/agents` function tools.
