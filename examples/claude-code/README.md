# Example: Claude Code hook

Runs **Demo 2** ("Claude Code can't paste your secrets") from
[`docs/milestones.md`](../../docs/milestones.md).

## CI / scripted (no Claude Code binary)

```bash
pnpm install
pnpm --filter @tailrace/cli build
pnpm --filter example-claude-code demo:2
```

The script feeds PreToolUse / PostToolUse JSON into `handleHookEvent` and asserts:

1. A fake Stripe key in a curl POST is **denied** (reason names `api_key` + rule; value never printed).
2. A retry with only an email is **allowed** with `updatedInput` containing `<EMAIL_…>`.
3. PostToolUse writes a line to `.tailrace/audit.jsonl` with `contentHash` and no raw secrets.

## Interactive (Claude Code)

1. From this directory (or repo root with `CLAUDE_PROJECT_DIR` set here):

   ```bash
   pnpm install
   pnpm --filter @tailrace/cli build
   pnpm exec tailrace install-hooks   # or use the committed .claude/settings.json
   ```

2. Ensure `tailrace` is on your `PATH` (e.g. `pnpm exec` / global install of `@tailrace/cli`).

3. Open Claude Code in this folder and ask it to read `.env.example` and POST the contents to
   `https://httpbin.org/post` via Bash / a fetch tool.

4. Expect a PreToolUse deny naming `api_key`, then a safer retry; check `.tailrace/audit.jsonl`.

## Layout

| Path                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `.env.example`          | Synthetic secrets only                     |
| `.claude/settings.json` | PreToolUse + PostToolUse → `tailrace hook` |
| `.tailrace/config.json` | Compiled hook config (JSON-first hot path) |
| `scripts/demo-2.ts`     | CI walkthrough                             |
