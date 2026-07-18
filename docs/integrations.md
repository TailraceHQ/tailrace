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

User guide: [`docs/guides/mcp-integration.md`](guides/mcp-integration.md).
Docs site: `/docs/reference/mcp`, `/docs/integrations/mcp`, `/docs/guides/govern-mcp-tool-calls`.
Implementation plan: [`m5-plan.md`](m5-plan.md).

**Peer dependency:** `@modelcontextprotocol/sdk` `>=1`. Types bind against the installed SDK's
`Transport` from `@modelcontextprotocol/sdk/shared/transport` (`start` / `send` / `close` /
`onclose` / `onerror` / `onmessage` / optional `sessionId` / `setProtocolVersion`). As of
`@modelcontextprotocol/sdk@1.29.0`. Record further drift here when upgrading the SDK.

### Public API (Option C)

```ts
import { wrapTransport, withMcp } from "@tailrace/mcp";

const transport = wrapTransport(tailrace, sseTransport, { server: "salesforce" });

const t = withMcp(createTailrace());
const wrapped = t.transport(sseTransport, { server: "salesforce" });
```

```ts
interface McpWrapOptions {
  server: string;
  agent?: string;
  workflowId?: string;
  onDecision?: (decisions: Decision[]) => void;
}
```

### Intercepted methods

| Direction | JSON-RPC method | What is scanned | Boundary |
|---|---|---|---|
| Out | `tools/call` | `params.arguments` | `{ kind: "mcp", server, tool: params.name, direction: "out" }` |
| In | `tools/call` result | result payload | same with `direction: "in"` |
| In | `resources/read` result | result payload | `{ kind: "mcp", server, tool: "read", direction: "in" }` |

All other JSON-RPC messages pass through unchanged. For `resources/read`, `tool` is always the
stable literal `"read"` (not the resource URI basename) so policy keys like `mcp:salesforce/read`
are predictable.

### Block translation

Do **not** tear down the transport. Synthesize a JSON-RPC 2.0 **error response** for the pending
request id:

```json
{
  "jsonrpc": "2.0",
  "id": "<request-id>",
  "error": {
    "code": -32001,
    "message": "Blocked by data policy: api_key may not be sent to mcp (rule: …)",
    "data": { "type": "policy_violation", "entity": "api_key", "rule": "…" }
  }
}
```

- Outbound block: never `send` the request to the server; deliver the error via `onmessage`.
- Inbound block: replace the result with the error before calling the client's `onmessage`.
- Tokenize/mask: rewrite `arguments` / result and forward.

Identity defaults: `agent` / `workflowId` → `"default"` when unset.

## 3. @tailrace/hono: middleware

User guide: [`docs/guides/hono-integration.md`](guides/hono-integration.md).
Docs site: `/docs/reference/hono`, `/docs/integrations/hono`.
Implementation plan: [`m5-plan.md`](m5-plan.md) (M9 refactor: [`m9-plan.md`](m9-plan.md)).

**Peer dependency:** `hono` `>=4`. Types bind against installed `MiddlewareHandler` / `Context`
from `hono` (`MiddlewareHandler = (c, next) => Promise<R | void>`). As of `hono@4.12.x`.

**Depends on:** `@tailrace/core` + `@tailrace/http` (public API only). Thin host wrapper; shared
OpenAI-compat / SSE / 422 logic lives in `@tailrace/http`.

```ts
import { tailraceHono } from "@tailrace/hono";

app.use(
  "/v1/*",
  tailraceHono(tailrace, {
    mode: "openai-compatible",
    agent: (c) => c.req.header("x-agent-id") ?? "default",
    workflowId: (c) => c.req.header("x-workflow-id") ?? "default",
  }),
);
```

```ts
interface TailraceHonoOptions {
  mode?: "openai-compatible"; // only mode in v0.1; default
  agent?: (c: Context) => string;
  workflowId?: string | ((c: Context) => string);
  onDecision?: (decisions: Decision[]) => void;
}
```

Parses OpenAI-format chat request bodies, `check`s message text contents at boundary
`{ kind: "model", provider }` where `provider` is the request body's `model` string **as-is**,
forwards; scans response bodies including SSE streaming.

**Carry-buffer:** implemented in `@tailrace/http` (same hold-back algorithm as `@tailrace/ai-sdk`).
Must not import `@tailrace/ai-sdk`. No `streamBlockBehavior` option in v0.1 (abort-equivalent only
for SSE).

### Block translation

| Surface | Behavior |
|---|---|
| Request (before `next`) | **422** JSON `{ error: { type: "policy_violation", entity, rule } }` |
| JSON response (non-SSE) | **422** same shape; do not forward the blocked body |
| SSE (`text/event-stream`) | Cancel upstream; emit one SSE `data:` event with the same error object; close |

Tokenize/mask rewrites the request/response body (or SSE text deltas) in place and continues.

This package is thin by design - it exists to serve Workers users and as the shape of other HTTP
gateway plugins (see §9–§13).

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

## 6. @tailrace/adapter: shared tool-wrap helpers

Host-agnostic helpers for integrations. **No host peer dependencies.** Runtime matrix matches core (Node + workerd). Not a drop-in product by itself; consumed by `@tailrace/openai-agents`, optionally `@tailrace/ai-sdk`, and `@tailrace/cloudflare-agents`.

```ts
import {
  wrapToolExecute,
  runGoverned,
  asCheckable,
  unwrapCheckable,
  formatToolBlockError,
} from "@tailrace/adapter";

const execute = wrapToolExecute(tailrace, "crm", originalExecute, {
  agent: "support",
  workflowId: "wf-1",
});

await runGoverned(
  tailrace,
  {
    boundary: { kind: "tool", name: "crm", direction: "out" },
    input: args,
    agent: "support",
    workflowId: "wf-1",
  },
  async () => handler(),
);
```

| Export | Role |
|---|---|
| `asCheckable` / `unwrapCheckable` | Normalize unknown values for `check`, then restore shape |
| `formatToolBlockError` | Value-free tool block string (same wording as ai-sdk §1.3) |
| `wrapToolExecute` | Wrap one `execute` fn: check args `out`, result `in` |
| `runGoverned` | Preflight check on `input` at caller-supplied `Boundary`, run handler, optional result check |

Caller always supplies `Boundary` (or tool name for `wrapToolExecute`). Adapter never invents policy.

## 7. @tailrace/openai-agents: OpenAI Agents SDK

User guide: [`docs/guides/openai-agents-integration.md`](guides/openai-agents-integration.md).

**Peer dependency:** `@openai/agents` `>=0.3`. Bound against `@openai/agents@0.3.9` / `@openai/agents-core`: `FunctionTool` exposes `invoke(runContext, input: string)` (user `execute` in `tool()` options is compiled into `invoke`). Record further drift here when upgrading.

### Public API (Option C)

```ts
import { wrapTools, withOpenAiAgents } from "@tailrace/openai-agents";
import { Agent, tool } from "@openai/agents";

const tools = wrapTools(tailrace, [crmTool], { agent: "support", workflowId: "wf-1" });

const t = withOpenAiAgents(createTailrace());
const tools2 = t.tools([crmTool], { agent: "support" });
```

| Surface | Behavior |
|---|---|
| Function tools | Wrap `execute`: args `{ kind: "tool", name, direction: "out" }`; result `direction: "in"` |
| Block | Throw `Error` with `formatToolBlockError` so the model can self-correct |
| Hosted tools | Out of scope (run off-process) |
| Model / prompt scan | Out of scope for M7; use tool wraps + SDK input guardrails |

Deps: `@tailrace/core` + `@tailrace/adapter`.

## 8. @tailrace/cloudflare-agents: Cloudflare Agents (Compose)

User guide: [`docs/guides/cloudflare-agents-integration.md`](guides/cloudflare-agents-integration.md).

**Compose:** depends on `@tailrace/ai-sdk` public API for `wrapModel` / `wrapTools` / streaming. Does **not** reimplement carry-buffer or `streamBlockBehavior`.

**Peers:** `ai@^5` (required, same as `@tailrace/ai-sdk`); `agents` `>=0.17` optional for host alignment. `@cloudflare/ai-chat` commonly peers `ai@^6` — Compose targets AI SDK v5 middleware today; document upgrades in this section when `@tailrace/ai-sdk` moves. Bound at M7c against `ai@5.0.x`.

```ts
import { createCloudflareTailrace, withCloudflareAgents } from "@tailrace/cloudflare-agents";

const tr = createCloudflareTailrace(env, {
  agent: this.name,
  workflowId: this.name,
  kv: env.TAILRACE_VAULT,
});

const { model, tools } = withCloudflareAgents(tr).forChat({
  model: baseModel,
  tools: { crm: crmTool },
  streamBlockBehavior: "abort",
});
```

| Helper | Behavior |
|---|---|
| `createCloudflareTailrace` | Builds Tailrace with `kvVault(kv)` when `kv` provided, else `memoryVault()`; identity from opts |
| `forChat` | Returns ai-sdk-wrapped `model` + `tools` |
| `wrapOnToolCall` | Check tool args `out` before user handler; check output `in` before `addToolOutput` |

Default `workflowId` / `agent` = Durable Object or agent instance name when provided.

## 9. @tailrace/http: shared OpenAI-compat pipeline

Implementation plan: [`m9-plan.md`](m9-plan.md).

**No host peers.** Depends on `@tailrace/core` only. Runtime: Node + workerd (Web APIs only - no
`node:` imports). Consumed by `@tailrace/hono`, `@tailrace/express`, `@tailrace/fastify`,
`@tailrace/nestjs`, `@tailrace/encore`.

| Export | Role |
|---|---|
| `parseOpenAiBody` / `extractMessageTextTree` / `extractCompletionText` / `applyCompletionText` | OpenAI chat body helpers |
| `policyViolationBody` / `POLICY_VIOLATION_STATUS` | 422 body builder (`422`) |
| `CARRY_BUFFER_SIZE` / `createOpenAiCompatSseTransform` | SSE hold-back transform over `ReadableStream<Uint8Array>` |
| `runOpenAiCompatRequestCheck` / `runOpenAiCompatJsonResponseCheck` | Pure pipeline helpers taking `Tailrace` + identity opts (not a host `Context`) |
| `modelBoundaryFromBody` / `isEventStream` | Boundary + content-type helpers |

Must not import any framework package. Gateways resolve agent/workflowId from their host request,
then call these helpers.

## 10. @tailrace/express: middleware

User guide: [`docs/guides/express-integration.md`](guides/express-integration.md).

**Peer dependency:** `express` `>=4`. Depends on `@tailrace/core` + `@tailrace/http`.

```ts
import { tailraceExpress } from "@tailrace/express";

app.use("/v1", tailraceExpress(tailrace, {
  mode: "openai-compatible",
  agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
  workflowId: (req) => String(req.headers["x-workflow-id"] ?? "default"),
}));
```

Same openai-compat contract as §3 (422 / SSE abort). Expects a JSON body (`express.json()` or
equivalent) for chat requests; buffers/intercepts response for JSON + SSE rewrite.

## 11. @tailrace/fastify: plugin

User guide: [`docs/guides/fastify-integration.md`](guides/fastify-integration.md).

**Peer dependency:** `fastify` `>=4`. Depends on `@tailrace/core` + `@tailrace/http`.

```ts
import { tailraceFastify } from "@tailrace/fastify";

await app.register(tailraceFastify(tailrace, {
  mode: "openai-compatible",
  agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
}));
```

Uses `preHandler` for request check and `onSend` / raw stream wrapping for JSON + SSE responses.
Same §3 contract.

## 12. @tailrace/nestjs: middleware module

User guide: [`docs/guides/nestjs-integration.md`](guides/nestjs-integration.md).

**Peer dependency:** `@nestjs/common` `>=10`. Depends on `@tailrace/core` + `@tailrace/http`.
Primary CI target: Nest + **Express** adapter. Nest + Fastify adapter is supported via Nest's
HTTP abstractions where possible; document Fastify as secondary.

```ts
import { TailraceModule } from "@tailrace/nestjs";

@Module({
  imports: [
    TailraceModule.forRoot({
      tailrace,
      forRoutes: ["v1/*path"],
      agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
    }),
  ],
})
export class AppModule {}
```

Exports `TailraceModule.forRoot` and `TailraceMiddleware`. Applies the same openai-compat §3
contract on configured routes. Nest 11 route globs use named splats (`v1/*path`, not `v1*`).

## 13. @tailrace/encore: middleware

User guide: [`docs/guides/encore-integration.md`](guides/encore-integration.md).

**Peer dependency:** `encore.dev` `>=1.46` (bound against `encore.dev@1.57.x`
`middleware` / `HandlerResponse` / `MiddlewareRequest`). Depends on `@tailrace/core` +
`@tailrace/http`.

```ts
import { tailraceEncore } from "@tailrace/encore";
import { Service } from "encore.dev/service";

export default new Service("api", {
  middlewares: [
    tailraceEncore(tailrace, {
      mode: "openai-compatible",
      agent: "api",
    }),
  ],
});
```

Targets **raw** OpenAI-proxy endpoints (`isRaw: true`) so request/response bodies and SSE are
available via `req.rawRequest` / `req.rawResponse`. Typed Encore APIs that return structured chat
payloads get the same check on request payload / `HandlerResponse.payload` when the body shape
matches openai-compat. Bound against installed `encore.dev/api` `middleware` types; record drift
here when upgrading.

## 14. @tailrace/trpc: procedure middleware

User guide: [`docs/guides/trpc-integration.md`](guides/trpc-integration.md).

**Peer dependency:** `@trpc/server` `>=10` (bound against `@trpc/server@11.x`). Depends on
`@tailrace/core` + `@tailrace/adapter` (not `@tailrace/http`). tRPC is RPC, not an OpenAI
REST gateway.

```ts
import { createTailraceMiddleware, withTrpc } from "@tailrace/trpc";

const governed = createTailraceMiddleware(tailrace, {
  agent: "api",
  name: ({ path }) => path,
  workflowId: ({ ctx }) => (ctx as { workflowId?: string }).workflowId ?? "default",
});

const procedure = t.procedure.use(governed);

// Option C
const tr = withTrpc(createTailrace());
const procedure2 = t.procedure.use(tr.middleware({ agent: "api" }));
```

| Surface | Behavior |
|---|---|
| Input | `check` at `{ kind: "tool", name, direction: "out" }` before `next` |
| Output | `check` result data at `direction: "in"`; rewrite `ok` result data on tokenize/mask |
| Block | Throw `TRPCError` (`BAD_REQUEST`) with `formatToolBlockError` / value-free message |
| Streaming procedures | v0.1: non-streaming queries/mutations only; streaming deferred |

Bound against installed `@trpc/server` at implement time; record drift here when upgrading.
