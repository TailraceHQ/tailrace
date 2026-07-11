# @tailrace/cli

The `tailrace` binary.

- `tailrace init` - detect the stack and scaffold `tailrace.config.ts` with the default policy.
- `tailrace scan <path|->` - Tier 0 secret/PII scan of files or stdin; exits 1 on a `block`-class hit. Doubles as a pre-commit secret scanner.
- `tailrace install-hooks` - non-destructively merge Tailrace hook entries into Claude Code `settings.json` (with a backup).
- `tailrace hook` - the Claude Code hook handler (p50 < 150ms).

> **M0 skeleton.** Commands throw `NotImplementedError` until milestone M4
> (see [`docs/milestones.md`](../../docs/milestones.md)).
