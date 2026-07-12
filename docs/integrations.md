# Integrations Spec

Integrations construct `Boundary` + `Identity`, call `tailrace.check`/`tailrace.restore`, and translate `PolicyViolationError` into the host framework's native failure mode. They contain zero policy logic.

## 1. @tailrace/ai-sdk: Vercel AI SDK middleware (flagship)

**Peer dependency:** `ai@^5`. User guide: [`docs/guides/ai-sdk-integration.md`](guides/ai-sdk-integration.md). Docs site: `/docs/reference/ai-sdk`. Types bind against the installed package (`LanguageModelV2` middleware:
`transformParams`, `wrapGenerate`, `wrapStream`). As of `ai@5.0.x`, middleware is
`LanguageModelV2Middleware` from `@ai-sdk/provider@2.x` (pinned as a matching devDependency in
`@tailrace/ai-sdk`). Prompt shape is `LanguageModelV2Prompt` (system string content; user/assistant
part arrays). Stream parts use `text-delta` (not a single `text` chunk type). Record further drift
here in the same PR when upgrading `ai`.

### Public API (both forms: Option C)

Standalone functions (framework-free call sites, tree-shake friendly):

```ts
import { wrapModel, wrapTools } from "@tailrace/ai-sdk";

const model = wrapModel(tailrace, openai("gpt-4o"), opts);
const tools = wrapTools(tailrace, { crm: crmTool }, opts);
```

Fluent form via `withAiSdk` (same implementations, ergonomic quickstart):

```ts
import { withAiSdk } from "@tailrace/ai-sdk";

const tailrace = withAiSdk(createTailrace());
const model = tailrace.model(openai("gpt-4o"), opts);
const tools = tailrace.tools({ crm: crmTool }, opts);
```

`@tailrace/core` MUST NOT import `ai` or host framework types. Fluent methods live entirely in `@tailrace/ai-sdk`.

### Wrap options

```ts
type StreamBlockBehavior = "abort" | "buffer" | "redact";

interface AiSdkWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  /** Output streaming only. Default: "abort" (fail-closed). See §1.4. */
  streamBlockBehavior?: StreamBlockBehavior;
  onDecision?: (decisions: Decision[]) => void;
}
```

### 1.1 Model boundary (input and output)

Prompt and completion scanning both use the **same model boundary**:

```ts
{ kind: "model", provider: string }
```

Do **not** use the `telemetry` boundary for AI SDK middleware in v0.1.

**Provider encoding:** `${providerId}/${modelId}` from the wrapped model after middleware overrides (e.g. `openai/gpt-4o`). This matches policy glob keys like `openai/*` and exact keys like `openai/gpt-4o` (policy-engine.md §3).

Normalization rules:

- If `modelId` already contains `/` (gateway-style `provider/model`), use it as-is - do not double-prefix.
- If `modelId` is missing, fall back to `providerId` alone.

### 1.2 `wrapModel` / `tailrace.model`

Wrap via the AI SDK `wrapLanguageModel` middleware API (`transformParams`, `wrapGenerate`, `wrapStream`).

**`transformParams`:** Run `check` over prompt messages - system, user, assistant, and tool-result **text** parts. Skip image/file/binary parts in v0.1. Rewrite in place. On `block`, throw `PolicyViolationError` (call never reaches the provider).

**`wrapGenerate`:** After the model returns, run `check` on output text at the same model boundary. On `block`, throw `PolicyViolationError` before returning to the caller. On `tokenize`/`mask`/`allow`, rewrite in place.

**`wrapStream`:** See §1.4. Reuse the carry-buffer technique from vault.md §5 for detection across chunk boundaries. Implementation: one `check` per chunk with `CheckOptions.stream.holdback` so the emit cut never bisects a detected span (integrations must not re-check truncated slices).

### 1.3 `wrapTools` / `tailrace.tools`

Wrap each tool's `execute`:

- Args: `check` at `{ kind: "tool", name, direction: "out" }`
- Return value: `check` at `{ kind: "tool", name, direction: "in" }`

Tools without an `execute` function pass through unchanged.

Blocked ⇒ throw; the AI SDK surfaces tool errors to the model (self-correction loop). Preserve the tool set's type signature exactly (generics, no `any`).

**Error translation:**

| Surface | `PolicyViolationError` becomes |
|---|---|
| `transformParams` / `wrapGenerate` | Aborted call; value-free message |
| `wrapStream` (`abort` / `buffer`) | Failed stream; `PolicyViolationError` |
| `wrapStream` (`redact`) | Stream continues with masked spans |
| Tool `execute` | Tool error string: `"Blocked by data policy: {entity} may not be sent to {boundary} (rule: {rule})"` |

### 1.4 Streaming output: `streamBlockBehavior`

Policy still resolves to `block`; the integration chooses how to **translate** `block` at the streaming surface (same pattern as tool error strings vs abort).

| Mode | Behavior | Fail-closed? | Streaming UX |
|---|---|---|---|
| **`abort`** (default) | Hold-back scan + carry buffer; cancel upstream; throw `PolicyViolationError` if any span resolves to `block` | Yes | Incremental output for confirmed-safe prefix |
| **`buffer`** | Accumulate entire response; run `check` once at end; throw on `block` | Yes | No incremental output until complete |
| **`redact`** | Hold-back scan; on `block`, apply as **`mask`** (not tokenize) and continue streaming | No: opt-in | Stream never aborts; secrets become `[ENTITY]` labels |

**Not supported:** emit-then-scan without hold-back (partial secret leakage).

For **`redact`**, pass `applyBlockAs: "mask"` on `check` (policy-engine.md §5). Audit records the resolved action as `block` plus `appliedAs: "mask"`.

Non-streaming `wrapGenerate` always uses throw-on-`block` semantics (no `streamBlockBehavior` override).

### 1.5 Tests (M3 acceptance)

- Adversarial streaming chunking: 1-char chunks, chunk boundary mid-token, chunk boundary mid-`sk_test_` prefix.
- All three `streamBlockBehavior` modes.
- Type-level: `expect-type` tests that wrapped tools preserve generics.
- Provider encoding: `openai/*` glob matches combined `openai/gpt-4o` boundary.

## 2. @tailrace/mcp: MCP client wrapper

```ts
tailrace.mcp<T extends Transport>(transport: T, opts: { server: string; agent?: string; workflowId?: string }): T
```

Wraps an MCP SDK client transport: intercept outbound `tools/call` requests (`check` arguments, boundary `{ kind: "mcp", server, tool, direction: "out" }`) and inbound results (`direction: "in"`). Blocked outbound ⇒ synthesize a JSON-RPC error result to the caller with the policy message (do not tear down the transport). Also scan `resources/read` results (direction "in"). Pin `@modelcontextprotocol/sdk` as peer; verify current transport interface from the SDK source before implementing.

Standalone + fluent (`withMcp`) same pattern as §1 when implemented in M5.

## 3. @tailrace/hono: middleware

```ts
app.use("/v1/*", tailraceHono(tailrace, { mode: "openai-compatible", agent: (c) => c.req.header("x-agent-id") ?? "default" }))
```

Parses OpenAI-format chat request bodies, `check`s message contents (boundary `model` with provider from the request's `model` field), forwards; scans response bodies incl. SSE streaming (reuse the carry-buffer transform). Blocked ⇒ 422 JSON `{ error: { type: "policy_violation", entity, rule } }`. This package is thin by design - it exists to serve Workers users and as the shape of a future gateway plugin.

## 4. @tailrace/cli: `tailrace` binary

User guide: [`docs/guides/block-secrets-in-claude-code.md`](guides/block-secrets-in-claude-code.md).
Docs site: `/docs/reference/cli`, `/docs/integrations/claude-code`.
Implementation plan: [`m4-plan.md`](m4-plan.md).

**Runtime:** Node >= 20 only (filesystem vault + settings merge). Depends on `@tailrace/core` only.

Commands:

| Command | Behavior |
|---|---|
| `tailrace init [--force]` | Detect stack from nearest `package.json` (`next` → `ai` → `hono` → generic Node). Write `tailrace.config.ts` (app authoring) and `.tailrace/config.json` (hook hot path). Refuse overwrite unless `--force`. Print a short integration snippet. |
| `tailrace scan <path\|-> [--json]` | Tier 0 scan of files or stdin. Exit `1` if any span resolves to `block`; exit `0` otherwise. Human output: path + entity + rule (never raw values). `--json`: machine-readable hits. Skips `node_modules`, `.git`, build dirs, binaries. |
| `tailrace install-hooks [--scope project\|user]` | Non-destructive merge into `.claude/settings.json` (project, default) or `~/.claude/settings.json` (user). Backup existing file to `settings.json.bak-<iso>` beside it; append Tailrace `PreToolUse` / `PostToolUse` entries only if missing (idempotent; detect by command substring `tailrace hook`). Ensures `.tailrace/config.json` exists. |
| `tailrace hook` | Claude Code hook handler (stdin JSON → stdout JSON). See below. |

### Config: JSON-first for Claude Code

v0.1 Claude Code path is **JSON-first**. The hook never imports or transpiles `tailrace.config.ts`.

| File | Role |
|---|---|
| `tailrace.config.ts` | Documented authoring format for AI SDK / app runtimes (`init` writes this). |
| `.tailrace/config.json` | Precompiled hot-path config. `init` / `install-hooks` write it. Hook loads via sync `readFile` + `JSON.parse` + `createTailrace`. |

```ts
interface CompiledCliConfig {
  version: 1;
  agent: string; // default "claude-code"
  /** Prefer env `TAILRACE_VAULT_KEY` in prod */
  vaultKey?: string;
  /** Serialized PolicyDocument. Omit ⇒ default policy */
  policy?: PolicyDocument;
}
```

Supporting paths under `$CLAUDE_PROJECT_DIR` (else `cwd`):

- `.tailrace/vault/` - file-backed `kvVault` (each hook is a new process; tokens need a stable key)
- `.tailrace/audit.jsonl` - `jsonlSink` audit trail

Config loading stays in `@tailrace/cli`. There is **no** `filePolicy` export from `@tailrace/core` in v0.1 (see architecture.md §5).

### Claude Code hook handler contract (`tailrace hook`)

Verified against the live [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) at M4 implementation time. Record further drift here in the same PR when Claude Code changes.

**Install shape** (`install-hooks` writes matcher `"*"` = all tools):

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "tailrace hook" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "tailrace hook" }] }]
  }
}
```

Published users may use `npx @tailrace/cli hook` or a global `tailrace` on `PATH`; the installed command string is `tailrace hook`.

**Stdin fields used:** `session_id`, `hook_event_name`, `tool_name`, `tool_input` (PreToolUse); PostToolUse also `tool_response`. Unknown `hook_event_name` → exit 0, empty stdout (forward-compatible).

**Identity / workflow:** agent from config (default `"claude-code"`); `workflowId = session_id` (fallback `"default"`) ⇒ token stability across a Claude Code session.

**Boundaries:**

| Event | Payload | Boundary |
|---|---|---|
| PreToolUse | `tool_input` | `{ kind: "tool", name: tool_name, direction: "out" }` |
| PostToolUse | `tool_response` | `{ kind: "tool", name: tool_name, direction: "in" }` |

**Output contract - JSON path exclusively.** Always exit `0` for policy decisions. Do not use exit-code-2 for deny (Claude Code ignores stdout JSON on exit 2). Process errors (bad JSON, missing config) exit `1` with a stderr message; Claude Code treats that as a non-blocking hook failure, not a clean deny.

| Case | Exit | Stdout |
|---|---|---|
| Clean PreToolUse (no rewrite) | 0 | empty (prefer empty over explicit `"allow"` when unchanged) |
| PreToolUse tokenize/mask | 0 | `hookSpecificOutput` with `hookEventName: "PreToolUse"`, `permissionDecision: "allow"`, `updatedInput` = **full** rewritten `tool_input` (not a patch) |
| PreToolUse block | 0 | `permissionDecision: "deny"`, `permissionDecisionReason` naming entity + rule (never the value) |
| PostToolUse (any outcome) | 0 | empty. Audit-only in v0.1: scan for decisions/emit; **do not** rewrite (`updatedToolOutput`) or deny. Optional stderr note behind `TAILRACE_DEBUG=1` only |

Example deny:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Blocked by data policy: api_key may not be sent to tool (rule: …)"
  }
}
```

**Perf:** end-to-end p50 < 150ms including process spawn + config load (CI gate `hook-spawn-to-exit`). Forces: JSON-only config, single bundled bin, no Tier 1 in hook mode, defer vault fs until a tokenize action is required.

**Out of scope for v0.1 hooks:** `permissionDecision: "ask"` / `"defer"`, PostToolUse rewrite, UserPromptSubmit scanning, Tier 1 NER.

## 5. Shared integration rules

- Every integration accepts an optional `onDecision(decisions: Decision[])` callback and forwards to the Tailrace instance's audit emitter regardless.
- All wrappers must be identity-preserving in types: wrapping a model returns a `LanguageModel`, wrapping tools returns the same generic shape. If TypeScript inference degrades, that's a bug.
- Integration READMEs each contain a copy-paste quickstart ≤ 10 lines.
