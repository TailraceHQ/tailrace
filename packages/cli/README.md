# @tailrace/cli

The `tailrace` binary: scaffold config, scan for secrets, and enforce policy in Claude Code hooks.

```bash
pnpm add -D @tailrace/cli
pnpm exec tailrace init
pnpm exec tailrace install-hooks   # merges PreToolUse/PostToolUse into .claude/settings.json
```

Hook hot path loads `.tailrace/config.json` only (no TypeScript transpile). Spawn-to-exit p50 is gated under 150ms in CI.

**Custom patterns (v2 config):** add a `recognizers` array to `.tailrace/config.json` with validated regex sources. `tailrace scan` and `tailrace hook` load them via `definePatternRecognizer`. See [Write custom recognizers](https://tailrace.dev/docs/guides/write-custom-recognizers).

| Command                   | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `tailrace init`           | Write `tailrace.config.ts` + `.tailrace/config.json`                 |
| `tailrace scan <path\|->` | Tier 0 scan; exit 1 on block-class entities (`--json`)               |
| `tailrace install-hooks`  | Non-destructive Claude Code settings merge (`--scope project\|user`) |
| `tailrace hook`           | Claude Code hook handler (stdin JSON → stdout JSON)                  |
