# @tailrace/ai-sdk

Policy enforcement for the [Vercel AI SDK](https://sdk.vercel.ai) (`ai@^5`). Wrap a language model so prompts and completions pass through Tailrace before they reach a provider or your application. Wrap tools so arguments and return values are governed at the tool boundary.

Tailrace runs entirely in-process. There is no proxy, no sidecar, and no network call on the request hot path.

## Install

Add Tailrace and the AI SDK to your project:

```bash
pnpm add @tailrace/core @tailrace/ai-sdk ai
pnpm add @ai-sdk/openai   # or your provider package
```

`ai@^5` is a **peer dependency** of `@tailrace/ai-sdk`. Install it in the same package that imports the middleware.

## Create a Tailrace instance

Tailrace works with zero configuration. The default policy blocks secret-class entities and tokenizes common structured PII (email, phone, credit card, and others).

```ts
import { createTailrace } from "@tailrace/core";
import { withAiSdk } from "@tailrace/ai-sdk";

const tailrace = withAiSdk(createTailrace());
```

Use `withAiSdk` to attach fluent helpers (`tailrace.model`, `tailrace.tools`). Core stays free of AI SDK types. Prefer standalone functions when you want explicit imports:

```ts
import { wrapModel, wrapTools } from "@tailrace/ai-sdk";
```

## Wrap a model

Pass the wrapped model anywhere you would pass the original — `generateText`, `streamText`, agents, and other AI SDK APIs.

```ts
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const model = tailrace.model(openai("gpt-4o"), {
  agent: "support-bot",
  workflowId: "session-abc",
});

const { text } = await generateText({
  model,
  prompt: "Summarize the ticket.",
});
```

### What gets scanned

| Hook              | When it runs                     | Boundary                      |
| ----------------- | -------------------------------- | ----------------------------- |
| `transformParams` | Before the provider call         | `{ kind: "model", provider }` |
| `wrapGenerate`    | After a non-streaming completion | Same model boundary           |
| `wrapStream`      | On each streaming chunk          | Same model boundary           |

Tailrace scans **text** parts in system, user, assistant, and tool-result messages. Image, file, and other non-text parts pass through unchanged in v0.1.

The `provider` string is encoded as `${providerId}/${modelId}` (for example `openai/gpt-4o`). Gateway-style model IDs that already contain `/` are used as-is. This encoding drives policy keys such as `openai/*`.

## Wrap tools

```ts
import { tool } from "ai";
import { z } from "zod";

const tools = tailrace.tools(
  {
    crm: tool({
      description: "Look up a customer",
      inputSchema: z.object({ email: z.string() }),
      execute: async ({ email }) => fetchCustomer(email),
    }),
  },
  { agent: "support-bot", workflowId: "session-abc" },
);
```

Each tool with an `execute` function is wrapped:

- **Arguments** are checked at `{ kind: "tool", name, direction: "out" }`.
- **Return values** are checked at `{ kind: "tool", name, direction: "in" }`.

When policy blocks a tool call, the wrapper throws an error string the model can read and self-correct against:

```text
Blocked by data policy: api_key may not be sent to tool:fetch:out (rule: entities.api_key)
```

Tools without `execute` are returned unchanged.

## Restore at egress

Tokenization is reversible, but **detokenization only happens at trusted egress boundaries**. The model wrapper tokenizes PII in prompts; your route handler restores values before sending a response to the user:

```ts
const result = await generateText({ model, prompt });

const restored = await tailrace.restore(result.text, {
  boundary: { kind: "egress", sink: "ui" },
  identity: { agent: "support-bot" },
  workflowId: "session-abc",
});

return Response.json({ text: restored.output });
```

Calling `restore` at a model or tool boundary throws `InvariantViolationError` regardless of policy.

## Streaming output

For `streamText`, configure how a policy **`block`** on model output is translated:

```ts
const model = tailrace.model(openai("gpt-4o"), {
  streamBlockBehavior: "abort", // default
});
```

| Mode                  | Behavior                                                                               | Fail-closed |
| --------------------- | -------------------------------------------------------------------------------------- | ----------- |
| **`abort`** (default) | Hold-back scan with a carry buffer; cancel the stream and throw `PolicyViolationError` | Yes         |
| **`buffer`**          | Accumulate the full response, check once at end, throw on block                        | Yes         |
| **`redact`**          | Hold-back scan; replace blocked spans with `[ENTITY]` labels and continue              | No — opt-in |

Non-streaming `generateText` always throws on `block`. There is no streaming mode that emits text before scanning (partial secret leakage).

For very long single-line secrets (large JWTs, PEM keys) that exceed the 128-character carry window, use `streamBlockBehavior: "buffer"`.

## Options

```ts
interface AiSdkWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  streamBlockBehavior?: "abort" | "buffer" | "redact";
  onDecision?: (decisions: Decision[]) => void;
}
```

| Option                | Default     | Description                                                                          |
| --------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `agent`               | `"default"` | Identity for policy resolution (`identities` overrides in your policy document).     |
| `workflowId`          | `"default"` | Scopes vault tokens. Same value across steps yields the same token for the same PII. |
| `streamBlockBehavior` | `"abort"`   | How streaming output translates policy `block`.                                      |
| `onDecision`          | —           | Called with audit decisions after each check. Never includes raw values.             |

## Error handling

| Surface                                  | On `block`                                             |
| ---------------------------------------- | ------------------------------------------------------ |
| Model input (`transformParams`)          | Throws `PolicyViolationError` — provider is not called |
| Model output (`wrapGenerate`)            | Throws `PolicyViolationError`                          |
| Model output stream (`abort` / `buffer`) | Throws `PolicyViolationError`                          |
| Model output stream (`redact`)           | Stream continues; blocked spans become `[ENTITY]`      |
| Tool `execute`                           | Throws `Error` with the formatted policy message       |

Catch `PolicyViolationError` from `@tailrace/core` in route handlers. The error message names the entity class and rule path, never the detected value.

## Example app

The monorepo includes a runnable Next.js demo:

```bash
pnpm --filter example-nextjs-ai-sdk dev
pnpm --filter example-nextjs-ai-sdk demo:3
```

See [`examples/nextjs-ai-sdk`](../../examples/nextjs-ai-sdk/README.md).

## Further reading

- [AI SDK integration guide](../../docs/guides/ai-sdk-integration.md) — repo guide
- [Quickstart](../../apps/web/content/docs/get-started/quickstart.mdx) — five-minute tutorial
- [API reference](../../apps/web/content/docs/reference/ai-sdk/index.mdx) — exports and parameters
- [Integrations spec](../../docs/integrations.md) — normative behavior
