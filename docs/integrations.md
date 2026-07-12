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

Commands:
- `tailrace init` - detect stack (presence of `ai`, `hono`, `next` in package.json), write `tailrace.config.ts` from a template with the default policy inlined and commented, print the 3-line integration snippet for the detected stack.
- `tailrace scan <path|-> [--json]` - run Tier 0 over files or stdin; exit 1 if any `block`-class entity found. (Free utility value: works as a pre-commit secret scanner; mention in README.)
- `tailrace install-hooks [--scope project|user]` - merge our hook entries into `.claude/settings.json` (project) or `~/.claude/settings.json` (user). NEVER overwrite existing hooks: parse, append to the `PreToolUse`/`PostToolUse` matcher arrays, preserve formatting where feasible, back up the original file first. Print what was added.
- `tailrace hook` - the hook handler itself (see below).

### Claude Code hook handler contract (`tailrace hook`)

- Reads the event JSON from stdin (fields include `hook_event_name`, `tool_name`, `tool_input`).
- Loads `tailrace.config.ts` from `$CLAUDE_PROJECT_DIR` (esbuild-register or precompiled `tailrace.config.json` fallback; document the tradeoff, prefer compiling config to JSON at `install-hooks` time and recompiling on change for speed).
- Runs `check` on `tool_input` with boundary `{ kind: "tool", name: tool_name, direction: "out" }`, identity agent `"claude-code"` (configurable).
- Output contract - VERIFY against current Claude Code hooks reference before implementing; as of the docs this kit was written from:
  - allow: exit 0, no output (or JSON `permissionDecision: "allow"`).
  - tokenize/mask: exit 0 with stdout JSON `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": <rewritten tool_input>}}`.
  - block: exit 0 with `permissionDecision: "deny"` and `permissionDecisionReason` naming entity + rule (never the value). Do not mix exit-code-2 signaling with JSON output - choose the JSON path exclusively.
- Hard perf requirement: end-to-end p50 < 150ms including process spawn + config load (hooks run synchronously on every matched tool call). This forces: precompiled JSON config, lazy-nothing imports, no Tier 1 in hook mode.
- PostToolUse variant scans `tool_response` (direction "in") in `async` fire-and-forget mode for audit only.
- Workflow id = Claude Code `session_id` from the event payload ⇒ token stability across a whole session for free.

## 5. Shared integration rules

- Every integration accepts an optional `onDecision(decisions: Decision[])` callback and forwards to the Tailrace instance's audit emitter regardless.
- All wrappers must be identity-preserving in types: wrapping a model returns a `LanguageModel`, wrapping tools returns the same generic shape. If TypeScript inference degrades, that's a bug.
- Integration READMEs each contain a copy-paste quickstart ≤ 10 lines.
