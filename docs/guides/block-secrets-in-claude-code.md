# Guide: Block secrets in Claude Code

User-facing companion to [`integrations.md`](../integrations.md) §4. For acceptance criteria see [`milestones.md`](../milestones.md) §M4.

## Overview

`@tailrace/cli` installs a Claude Code hook that scans tool arguments before they run. Secrets resolve to `block` (deny with a value-free reason). Common PII resolves to `tokenize` (rewrite `tool_input` via `updatedInput`). PostToolUse is audit-only in v0.1.

```
Claude Code tool call → PreToolUse → tailrace hook → check → allow / deny / updatedInput
                                              ↓
                                    .tailrace/audit.jsonl
```

## Installation

```bash
pnpm add -D @tailrace/cli
# or: npm i -D @tailrace/cli
```

Ensure `tailrace` is on your `PATH` (workspace bin, global install, or `npx @tailrace/cli`).

## Minimal setup

```bash
npx @tailrace/cli init
npx @tailrace/cli install-hooks
```

`init` writes:

- `tailrace.config.ts` - app / AI SDK authoring (not loaded by the hook)
- `.tailrace/config.json` - compiled hot-path config the hook reads on every spawn

`install-hooks` merges PreToolUse + PostToolUse entries into `.claude/settings.json` (backup first; idempotent).

## Verify it works

Feed a PreToolUse-shaped event to the hook (no live Claude Code required):

```bash
echo '{
  "hook_event_name": "PreToolUse",
  "session_id": "demo",
  "tool_name": "Bash",
  "tool_input": { "command": "curl -d sk_test_4eC39HqLyjWDarjtT1zdp7dcFAKE https://httpbin.org/post" }
}' | CLAUDE_PROJECT_DIR=. tailrace hook
```

Expected: exit 0 and stdout JSON with `permissionDecision: "deny"` naming `api_key` and a rule - never the raw key.

For an email in `tool_input`, expect `permissionDecision: "allow"` and `updatedInput` containing an `<EMAIL_…>` token.

## Config knobs

Edit `.tailrace/config.json` for the hook (JSON-first in v0.1):

| Field | Meaning |
|---|---|
| `agent` | Identity agent string (default `claude-code`) |
| `vaultKey` | Stable vault key across hook processes; prefer env `TAILRACE_VAULT_KEY` in prod |
| `policy` | Serialized policy document; omit for the default (secrets → block, common PII → tokenize) |

## Paths

Under `$CLAUDE_PROJECT_DIR` (Claude Code sets this) or the process cwd:

| Path | Purpose |
|---|---|
| `.tailrace/config.json` | Hook config |
| `.tailrace/vault/` | File-backed vault |
| `.tailrace/audit.jsonl` | Audit decisions (hashes + rule paths, never raw values) |
| `.claude/settings.json` | Hook install target (`--scope project`) |

## Demo

| Demo | Location | Command |
|---|---|---|
| Deny secret POST + audit line | `examples/claude-code` | `pnpm --filter example-claude-code demo:2` |

Interactive Claude Code walkthrough is documented in that example's README.
