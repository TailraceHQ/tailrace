# Example: Claude Code hook

Runs **Demo 2** ("Claude Code can't paste your secrets") from
[`docs/milestones.md`](../../docs/milestones.md): a `settings.json` wired to the `tailrace` hook plus
a walkthrough where the hook denies an attempt to POST fake `.env` secrets, the agent retries with a
tokenized payload, and a PostToolUse audit line appears in `.tailrace/audit.jsonl`.

> Lands in milestone **M4**. This placeholder marks the location; the settings file and walkthrough
> arrive with the CLI + hook handler.
