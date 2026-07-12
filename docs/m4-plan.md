# M4 Implementation Plan: @tailrace/cli (Claude Code hooks)

> **Status: complete.** Acceptance criteria in [`milestones.md`](milestones.md) §M4 are checked off.
> This file is retained as the historical build plan; normative runtime behavior lives in
> [`integrations.md`](integrations.md) §4. User-facing walkthrough:
> [`guides/block-secrets-in-claude-code.md`](guides/block-secrets-in-claude-code.md).
> Locked decisions below are promoted into those docs and [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md) Resolved.
> Build strictly in the order below; each phase should be green in CI before starting the next.
> Remaining for M4 exit: Demo 2 example + CI dogfood scan step; check off [`milestones.md`](milestones.md) §M4 when green.

## Locked decisions (pre-flight)

| Topic | Decision |
|---|---|
| Public commands | `init`, `scan`, `install-hooks`, `hook` (no subcommand aliases in v0.1) |
| Hook I/O contract | **JSON path exclusively**: always exit `0`; decisions via stdout JSON. Never exit-code-2 for policy deny (integrations.md §4) |
| PreToolUse allow | Exit 0, empty stdout (or explicit `permissionDecision: "allow"` - prefer empty when unchanged) |
| PreToolUse tokenize/mask | Exit 0 + `hookSpecificOutput` with `permissionDecision: "allow"` + `updatedInput` (full rewritten `tool_input`) |
| PreToolUse block | Exit 0 + `permissionDecision: "deny"` + `permissionDecisionReason` naming entity + rule (never the value) |
| PostToolUse | Audit-only: scan `tool_response` at `{ kind: "tool", direction: "in" }`; do **not** rewrite or block in v0.1; exit 0 with no stdout |
| Agent identity | `"claude-code"` default; overridable in compiled config |
| Workflow id | Claude Code `session_id` from the hook event payload |
| Config source of truth | Human edits `tailrace.config.ts`; hook hot path loads **precompiled** `.tailrace/config.json` only |
| Config compile timing | `install-hooks` (and `init`) write/update `.tailrace/config.json`; optional `tailrace compile-config` is **out of scope** unless needed for DX |
| Config load on hot path | No `esbuild-register`, no dynamic TS transpile, no Tier 1. Sync `readFile` + `JSON.parse` + `createTailrace` |
| Vault across spawns | Each hook is a new process. Use **file-backed** vault under `.tailrace/vault/` via `kvVault` + Node fs adapter; master key from config or `TAILRACE_VAULT_KEY` (deterministic tokens still need a stable key) |
| Audit path | `jsonlSink` writing `.tailrace/audit.jsonl` under `$CLAUDE_PROJECT_DIR` |
| Hook matchers | Install both `PreToolUse` and `PostToolUse` for **all tools** (`matcher: "*"` per live Claude Code docs) |
| `install-hooks` merge | Non-destructive: backup → parse → append Tailrace entries if missing → write. Never wipe user hooks |
| `filePolicy` in core | **Not in M4.** Config loading stays in `@tailrace/cli`. architecture.md §5 updated (no core `filePolicy` export) |
| Demo 2 in CI | Scripted stdin fixtures exercising the hook binary (like M3 mock model). Live Claude Code walkthrough documented for humans; not required in CI |
| Dogfood | CI runs `tailrace scan` on the diff once the command lands (conventions.md) |

### Precompiled config shape (v0.1)

```ts
// .tailrace/config.json - produced by init / install-hooks
interface CompiledCliConfig {
  version: 1;
  agent: string; // default "claude-code"
  /** Hex or raw string; prefer env TAILRACE_VAULT_KEY in prod */
  vaultKey?: string;
  /** Serialized PolicyDocument (staticPolicy input). Omit ⇒ default policy */
  policy?: PolicyDocument;
}
```

`tailrace.config.ts` remains the documented authoring format for AI SDK / app users (`init` prints the right snippet). For Claude Code, the hook never imports that TS file on the hot path.

### Hook stdin (verify in Phase 0)

Common fields from the live Claude Code hooks reference (as of plan authoring):

- `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`
- PostToolUse also: `tool_response`

Update `integrations.md` §4 in the same PR if field names or output schema drifted.

---

## Phase 0: Live contract verification + CLI scaffold

**Goal:** Bind against the current Claude Code hooks docs; package builds and dispatches commands.

1. Re-read https://code.claude.com/docs/en/hooks (and hooks-guide). Record the exact:
   - `settings.json` hook entry shape (`matcher`, `hooks[].type`, `command`, `timeout`)
   - PreToolUse / PostToolUse stdin fields
   - stdout JSON for allow / deny / `updatedInput`
   - How to match all tools
2. Patch `docs/integrations.md` §4 for any drift (same PR as first implementation commit is fine). **Done** - §4 rewritten against live hooks reference; JSON-first config documented.
3. Wire `@tailrace/cli` deps: `vitest`, `@types/node`; keep runtime dep = `@tailrace/core` only if possible. Prefer zero CLI framework (hand-rolled argv) for spawn cost; if a parser is needed, choose the lightest option and justify in the PR.
4. Replace `NotImplementedError` stub with argv dispatch to command modules (still thin stubs OK until later phases).
5. Ensure `bin.tailrace` → `dist/cli.js` shebang works via `pnpm --filter @tailrace/cli build`.

**Exit:** `pnpm --filter @tailrace/cli typecheck` green; `tailrace --help` lists four commands.

---

## Phase 1: Shared CLI internals

**Goal:** DRY path resolution, config I/O, vault/audit wiring used by all commands.

Create `packages/cli/src/internal/` (not exported):

| Module | Responsibility |
|---|---|
| `paths.ts` | Resolve project dir (`$CLAUDE_PROJECT_DIR` \|\| `cwd`), `.tailrace/`, config paths, settings paths |
| `config.ts` | Read/write `tailrace.config.json`; validate `version`; build `Tailrace` from compiled config |
| `vault-fs.ts` | `kvVault` adapter over `.tailrace/vault/{workflowId}/{token}` (or single namespaced key layout) |
| `audit-fs.ts` | `jsonlSink` writer appending to `.tailrace/audit.jsonl` (create dir if needed) |
| `settings-merge.ts` | Backup + deep-merge Claude Code `settings.json` hook arrays |
| `args.ts` | Minimal argv parse (`--json`, `--scope`, positional path) |
| `errors.ts` | Map unexpected errors to stderr messages (never include detected values) |

**Exit:** unit tests for path resolution, settings merge on fixtures, config round-trip.

---

## Phase 2: `tailrace scan`

**Goal:** Free-standing Tier 0 secret scanner; dogfood target for CI.

1. `tailrace scan <path|-> [--json]`
2. Walk files (skip `node_modules`, `.git`, binary heuristics) or read stdin when path is `-`.
3. For each text file: `createTailrace()` (default policy) `check` at a synthetic boundary `{ kind: "tool", name: "scan", direction: "out" }` **or** detect + resolve without tokenize side effects - prefer **detect + resolve only** so scan never writes vault or mutates files.
4. Exit `1` if any span resolves to `block`; exit `0` otherwise.
5. Human output: file path + entity + rule (no raw values). `--json`: machine-readable array of hits.
6. Tests: fixture tree with synthetic `sk_test_...FAKE` → exit 1; clean tree → exit 0; assert stdout never contains fixture secret substrings.

**Exit:** scan tests green; document one-liner in package README.

---

## Phase 3: `tailrace init`

**Goal:** Zero-to-config scaffold.

1. Detect stack from nearest `package.json` deps/devDeps: `ai`, `hono`, `next` (and absence → generic Node).
2. Write `tailrace.config.ts` from a template: default policy inlined + short comments (≤ 6 comment lines per docs IA).
3. Also write initial `.tailrace/config.json` (compiled default) so hooks work before a separate compile step.
4. Print the 3-line integration snippet for the detected stack (AI SDK `withAiSdk`, Hono placeholder pointing at M5, Claude Code → run `install-hooks`).
5. Refuse to overwrite existing `tailrace.config.ts` unless `--force`.

**Exit:** init tests with temp dirs for each stack detection case.

---

## Phase 4: `tailrace install-hooks`

**Goal:** Non-destructive Claude Code settings merge + backup.

1. Flags: `--scope project|user` (default `project`).
   - project → `$CLAUDE_PROJECT_DIR/.claude/settings.json` (or `cwd/.claude/settings.json`)
   - user → `~/.claude/settings.json`
2. Backup: copy existing file to `settings.json.bak-<iso-timestamp>` beside it (or `.tailrace/backups/`) before write.
3. Parse JSON (empty object if missing). Append Tailrace hook commands to `hooks.PreToolUse` / `hooks.PostToolUse` arrays **only if** not already present (idempotent detect by command substring `tailrace hook`).
4. Command to install (verify absolute vs PATH in Phase 0):

   ```json
   {
     "type": "command",
     "command": "tailrace hook"
   }
   ```

   Prefer resolving to the workspace binary path in the example README; for published users, `npx @tailrace/cli hook` or global `tailrace hook`. Lock the exact string after Phase 0.

5. Recompile / refresh `.tailrace/config.json` from `tailrace.config.ts` if present (if TS compile is heavy, ship a JSON-only authoring path for Claude Code in v0.1 and document that `init` writes both). Prefer: **v0.1 Claude Code path is JSON-first**; `tailrace.config.ts` is for app runtimes. Document the tradeoff in README + integrations.md.
6. Print a summary of what was added.

**Exit:** merge tests covering: empty file, existing unrelated hooks, already-installed Tailrace (no dup), backup created.

---

## Phase 5: `tailrace hook` (PreToolUse)

**Goal:** Meet the output contract; fail closed on secrets; rewrite on tokenize.

1. Read all stdin → `JSON.parse`.
2. Ignore unknown `hook_event_name` with exit 0 empty (forward-compatible).
3. On `PreToolUse`:
   - Load compiled config + `createTailrace({ policy, vault: kvVault(fs), audit: { sinks: [jsonl] } })`.
   - `workflowId = event.session_id` (fallback `"default"` only if missing).
   - `await tailrace.check(tool_input, { boundary: { kind: "tool", name: tool_name, direction: "out" }, identity: { agent }, workflowId })`.
4. Map result:
   - no rewrite, no block → exit 0, no stdout
   - output ≠ input (tokenize/mask) → stdout JSON with `updatedInput: output` + `permissionDecision: "allow"`
   - `PolicyViolationError` → stdout JSON deny + reason from first blocking decision (`entity`, `rule`)
5. Process errors (bad JSON, missing config): stderr message + exit `1` (not policy deny). Document that Claude Code treats this as a hook failure, not a clean deny.

**Tests (fixture stdin):**

| Case | Expected |
|---|---|
| Clean `tool_input` | exit 0, empty stdout |
| Email in body | exit 0, `updatedInput` contains `<EMAIL_…>` token, no raw email |
| Fake Stripe key | exit 0, `permissionDecision: "deny"`, reason mentions `api_key` + rule, no raw key |
| Chunk-shaped: key split across object string leaves | still deny (object walk, not whole-JSON stringify) |

**Exit:** PreToolUse unit/integration tests green.

---

## Phase 6: `tailrace hook` (PostToolUse) + audit

**Goal:** Demo 2 audit line; no inbound rewrite in v0.1.

1. On `PostToolUse`: `check(tool_response, { direction: "in", ... })` inside try/catch.
2. On block: **do not deny** (tool already ran). Log/audit the decisions; exit 0. Optional: write a single stderr debug line behind `TAILRACE_DEBUG=1` only - default silent.
3. Confirm `.tailrace/audit.jsonl` receives events with `contentHash` + rule path and **zero** raw fixture values (grep test).

**Exit:** PostToolUse audit test green.

---

## Phase 7: Hook spawn-to-exit perf gate

**Goal:** p50 < 150ms including process spawn + config load.

1. Add `benchmarks/hook-spawn.mjs` (or extend `harness.mjs`) that:
   - Builds `@tailrace/cli` if needed
   - Spawns `node packages/cli/dist/cli.js hook` (or `tailrace hook`) with representative PreToolUse stdin (~1–2KB `tool_input` containing an email)
   - Measures wall-clock spawn-to-exit over N runs (e.g. 50 after warmup)
2. Gate: p50 < 150ms absolute (milestones.md), plus regression vs `baseline.json` entry `hook-spawn-to-exit`.
3. Optimizations if over budget (in order):
   - Ensure config is JSON-only
   - Lazy-import nothing heavy; single bundled cli entry
   - Avoid vault fs until a tokenize action is required
   - Keep tsup bundle for `cli.ts` as one file

**Exit:** `pnpm bench` fails if hook p50 ≥ 150ms or >20% over baseline.

---

## Phase 8: `examples/claude-code` (Demo 2)

**Goal:** Walkthrough runs Demo 2 from a fresh clone.

### Layout

```
examples/claude-code/
├── README.md                 # human walkthrough + CI script commands
├── .env.example              # synthetic secrets only (sk_test_…FAKE, etc.)
├── .claude/settings.json     # pre-merged Tailrace hooks (or generated by install-hooks)
├── .tailrace/config.json     # compiled default policy + vault key for demo
├── scripts/
│   ├── demo-2-pretooluse.ts  # feeds deny + tokenize fixtures to `tailrace hook`
│   └── demo-2-posttooluse.ts # asserts audit.jsonl line
└── package.json              # workspace example; depends on @tailrace/cli
```

### Demo 2 narrative (README)

1. Agent asked to read `.env.example` and POST contents to httpbin via a fetch/bash tool.
2. PreToolUse hook denies with reason naming `api_key` and the rule.
3. Agent retries with tokenized / redacted payload (simulated in CI; live with Claude Code for humans).
4. PostToolUse writes an audit line to `.tailrace/audit.jsonl`.

### CI

```bash
pnpm --filter example-claude-code demo:2
```

Script must not require a live Claude Code binary or network.

**Exit:** Demo 2 script green from clean clone; README documents the human Claude Code path separately.

---

## Phase 9: CI dogfood + docs polish

1. Add CI step: `tailrace scan` on changed files / repo (exclude fixtures that intentionally contain synthetic secrets - scan fixtures under a allowlist or use `--` exclude; **do not** fail the suite on `packages/*/fixtures` synthetic values - either exclude those paths or run scan only on non-fixture source).
2. Remove `--passWithNoTests` from `@tailrace/cli`; turbo `test` runs real suite.
3. eslint boundary: cli may use `node:` and `@tailrace/core` public API only.
4. Update `packages/cli/README.md` (≤ 10 line quickstart for Claude Code). **Done**
5. Docs site (M4 slice of IA): **Done**
   - `apps/web/content/docs/guides/block-secrets-in-claude-code.mdx`
   - `apps/web/content/docs/reference/cli.mdx`
   - `apps/web/content/docs/integrations/claude-code.mdx`
6. Promote M4 locked items into `OPEN_QUESTIONS.md` Resolved; add any new SPEC-QUESTIONs. **Done**
7. Link this plan from `milestones.md` §M4; check off boxes when green. (linked; boxes remain open until Demo 2 + CI gates pass)
8. Fix `docs/architecture.md` §5 `filePolicy` wording (defer to M5 or "CLI-local loader", not a core export). **Done**

**Exit:** M4 acceptance criteria pass in CI.

---

## File map (expected new/changed)

```
packages/cli/src/
  index.ts                 # run(argv) dispatch
  cli.ts                   # bin entry
  commands/
    init.ts
    scan.ts
    install-hooks.ts
    hook.ts
  internal/
    paths.ts
    config.ts
    vault-fs.ts
    audit-fs.ts
    settings-merge.ts
    args.ts
    errors.ts
  templates/
    config.ts.tmpl         # or .ts string export
  *.test.ts

packages/cli/package.json  # vitest; files include templates

benchmarks/
  harness.mjs              # or hook-spawn.mjs
  baseline.json            # + hook-spawn-to-exit

examples/claude-code/      # full example

docs/
  integrations.md          # contract verified / drift notes
  architecture.md          # filePolicy clarification
  m4-plan.md               # this file
  milestones.md            # link + checkboxes when done

apps/web/content/docs/
  guides/block-secrets-in-claude-code.mdx
  reference/cli.mdx
  integrations/claude-code.mdx

OPEN_QUESTIONS.md          # M4 resolutions
```

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Claude Code hook schema drifts | Phase 0 re-read live docs; update integrations.md same PR |
| Spawn + cold-start exceeds 150ms | JSON config only; single bundled bin; defer vault I/O until tokenize; measure early in Phase 7 |
| In-memory vault breaks token continuity across hook processes | File-backed `kvVault` + stable `TAILRACE_VAULT_KEY` / config key |
| `install-hooks` clobbers user settings | Backup first; append-only; idempotent detect; tests for merge |
| TS config too slow to load | Hook never loads TS; JSON-first for Claude Code in v0.1 |
| Scan dogfood false-positives on synthetic fixtures | Exclude fixture paths in CI scan invocation |
| Demo 2 needs live Claude Code | Scripted stdin fixtures for CI; README for interactive path |
| `updatedInput` must be full object replace | Always return complete rewritten `tool_input`, not a patch |

---

## Out of scope (M4)

- `@tailrace/mcp`, `@tailrace/hono` (M5)
- `filePolicy` as a `@tailrace/core` export
- PostToolUse rewrite / `updatedToolOutput` redaction
- Tier 1 NER in hook mode
- `review` action / `permissionDecision: "ask"` / `"defer"`
- Claude Desktop MCP shim
- UserPromptSubmit scanning (prompt-level) - tool boundary only in v0.1
- Publishing / changesets release polish (M5)
