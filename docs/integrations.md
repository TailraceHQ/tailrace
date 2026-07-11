# Integrations Spec

Integrations construct `Boundary` + `Identity`, call `tailrace.check`/`tailrace.restore`, and translate `PolicyViolationError` into the host framework's native failure mode. They contain zero policy logic.

## 1. @tailrace/ai-sdk — Vercel AI SDK middleware (flagship)

Public API:

```ts
tailrace.model(model: LanguageModel, opts?: { agent?: string; workflowId?: string | (() => string) }): LanguageModel
tailrace.tools<T extends ToolSet>(tools: T, opts?: { agent?: string; workflowId?: string }): T
```

`tailrace.model` wraps via the AI SDK's `wrapLanguageModel` middleware API:
- `transformParams`: run `check` (boundary `model`, provider string from the wrapped model's `modelId/provider`) over the prompt messages — system, user, assistant, and tool-result content parts. Rewrite in place.
- `wrapGenerate`: `check` the output text at boundary `telemetry`-safe form is NOT done here; output scanning uses the same `model` boundary with `direction` semantics folded into policy defaults. Detected secrets in output ⇒ apply policy (a model echoing a secret back is a real case).
- `wrapStream`: sliding-window scan + carry buffer per vault.md §5.
- Pin to the AI SDK major version in peerDependencies; check the installed `ai` package's middleware signature at build time and adapt — verify against the current AI SDK docs before implementing, do not code from memory.

`tailrace.tools` wraps each tool's `execute`: `check` args at `{ kind: "tool", name, direction: "out" }`, `check` the return value at `direction: "in"`. Blocked ⇒ throw; the AI SDK surfaces tool errors to the model, which is the desired self-correction loop. Preserve the tool's type signature exactly (generics, no `any`).

Error translation: `PolicyViolationError` from `transformParams` should abort the call with a clear, value-free message; from tools, it becomes the tool's error result string: `"Blocked by data policy: {entity} may not be sent to {boundary} (rule: {rule})"`.

## 2. @tailrace/mcp — MCP client wrapper

```ts
tailrace.mcp<T extends Transport>(transport: T, opts: { server: string; agent?: string; workflowId?: string }): T
```

Wraps an MCP SDK client transport: intercept outbound `tools/call` requests (`check` arguments, boundary `{ kind: "mcp", server, tool, direction: "out" }`) and inbound results (`direction: "in"`). Blocked outbound ⇒ synthesize a JSON-RPC error result to the caller with the policy message (do not tear down the transport). Also scan `resources/read` results (direction "in"). Pin `@modelcontextprotocol/sdk` as peer; verify current transport interface from the SDK source before implementing.

## 3. @tailrace/hono — middleware

```ts
app.use("/v1/*", tailraceHono(tailrace, { mode: "openai-compatible", agent: (c) => c.req.header("x-agent-id") ?? "default" }))
```

Parses OpenAI-format chat request bodies, `check`s message contents (boundary `model` with provider from the request's `model` field), forwards; scans response bodies incl. SSE streaming (reuse the carry-buffer transform). Blocked ⇒ 422 JSON `{ error: { type: "policy_violation", entity, rule } }`. This package is thin by design — it exists to serve Workers users and as the shape of a future gateway plugin.

## 4. @tailrace/cli — `tailrace` binary

Commands:
- `tailrace init` — detect stack (presence of `ai`, `hono`, `next` in package.json), write `tailrace.config.ts` from a template with the default policy inlined and commented, print the 3-line integration snippet for the detected stack.
- `tailrace scan <path|-> [--json]` — run Tier 0 over files or stdin; exit 1 if any `block`-class entity found. (Free utility value: works as a pre-commit secret scanner; mention in README.)
- `tailrace install-hooks [--scope project|user]` — merge our hook entries into `.claude/settings.json` (project) or `~/.claude/settings.json` (user). NEVER overwrite existing hooks: parse, append to the `PreToolUse`/`PostToolUse` matcher arrays, preserve formatting where feasible, back up the original file first. Print what was added.
- `tailrace hook` — the hook handler itself (see below).

### Claude Code hook handler contract (`tailrace hook`)

- Reads the event JSON from stdin (fields include `hook_event_name`, `tool_name`, `tool_input`).
- Loads `tailrace.config.ts` from `$CLAUDE_PROJECT_DIR` (esbuild-register or precompiled `tailrace.config.json` fallback; document the tradeoff, prefer compiling config to JSON at `install-hooks` time and recompiling on change for speed).
- Runs `check` on `tool_input` with boundary `{ kind: "tool", name: tool_name, direction: "out" }`, identity agent `"claude-code"` (configurable).
- Output contract — VERIFY against current Claude Code hooks reference before implementing; as of the docs this kit was written from:
  - allow: exit 0, no output (or JSON `permissionDecision: "allow"`).
  - tokenize/mask: exit 0 with stdout JSON `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": <rewritten tool_input>}}`.
  - block: exit 0 with `permissionDecision: "deny"` and `permissionDecisionReason` naming entity + rule (never the value). Do not mix exit-code-2 signaling with JSON output — choose the JSON path exclusively.
- Hard perf requirement: end-to-end p50 < 150ms including process spawn + config load (hooks run synchronously on every matched tool call). This forces: precompiled JSON config, lazy-nothing imports, no Tier 1 in hook mode.
- PostToolUse variant scans `tool_response` (direction "in") in `async` fire-and-forget mode for audit only.
- Workflow id = Claude Code `session_id` from the event payload ⇒ token stability across a whole session for free.

## 5. Shared integration rules

- Every integration accepts an optional `onDecision(decisions: Decision[])` callback and forwards to the Tailrace instance's audit emitter regardless.
- All wrappers must be identity-preserving in types: wrapping a model returns a `LanguageModel`, wrapping tools returns the same generic shape. If TypeScript inference degrades, that's a bug.
- Integration READMEs each contain a copy-paste quickstart ≤ 10 lines.
