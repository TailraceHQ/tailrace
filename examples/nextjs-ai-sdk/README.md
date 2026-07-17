# Next.js + @tailrace/ai-sdk

## What you will ship

A Vercel-deployable Next.js App Router agent that runs Tailrace at the AI SDK model and tool boundaries: secrets are blocked before the provider, common PII is tokenized on the way out, and values are restored at egress for the UI. Locally it uses an in-process mock (no API keys). With `OPENAI_API_KEY` set, the same route calls OpenAI and a governed `lookupCustomer` tool.

## Prerequisites

- Node 20+
- pnpm (from the monorepo root)

## Setup

From the repository root:

```bash
pnpm install
pnpm --filter @tailrace/core build
pnpm --filter @tailrace/ai-sdk build
```

Copy env vars when you want the live path:

```bash
cp examples/nextjs-ai-sdk/.env.example examples/nextjs-ai-sdk/.env.local
```

| Variable             | When needed                                        |
| -------------------- | -------------------------------------------------- |
| `OPENAI_API_KEY`     | Live provider path (omit for mock / CI)            |
| `TAILRACE_VAULT_KEY` | Live and deploy; mock uses a labeled demo fallback |

## Demo 1: interactive (local verification)

Start the dev server:

```bash
pnpm --filter example-nextjs-ai-sdk dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run A: block a secret

Click **Run A - block secret** or send a prompt that includes the fake Stripe test key:

```text
Use key sk_test_51FakeKeyForTailraceTests000FAKE and email customer@example.com
```

**Expected result:** HTTP **422** with a JSON body similar to:

```json
{
  "error": {
    "type": "policy_violation",
    "entity": "api_key",
    "rule": "entities.api_key",
    "message": "policy blocked entity \"api_key\" via rule \"entities.api_key\""
  }
}
```

The secret never reaches the model. Check the server console: Tailrace audit lines list `entity` and `contentHash`, never the raw key.

### Run B: tokenize and restore

Click **Run B - tokenize + restore** or send:

```text
Please email customer@example.com about the invoice.
```

**Expected result:** HTTP **200** with:

```json
{
  "text": "Please email customer@example.com about the invoice.",
  "workflowId": "<uuid>",
  "modelSaw": "Please email <EMAIL_xxxxxxxx> about the invoice."
}
```

- `modelSaw` is what the provider received after `transformParams` tokenized the email.
- `text` is the egress-restored string your UI displays.

### Tool-using prompt (live path)

With `OPENAI_API_KEY` set, ask the model to use the governed tool:

```text
Look up customer cust_42 and draft a short reply to their email.
```

`lookupCustomer` returns synthetic `customer@example.com`. Tailrace tokenizes that result on the tool `in` boundary; egress restore puts the real address back in the UI response.

### How it works

The route handler ([`app/api/chat/route.ts`](app/api/chat/route.ts)):

1. Selects `createEchoModel()` when `OPENAI_API_KEY` is absent; otherwise `openai("gpt-4o-mini")`.
2. Creates a per-request `workflowId` from the `x-workflow-id` header.
3. Wraps the model with `tailrace.model(...)` and tools with `tailrace.tools(...)`.
4. Calls `generateText` - Tailrace scans the prompt (and tool traffic) before work proceeds.
5. On success, calls `tailrace.restore` at `{ kind: "egress", sink: "ui" }` before responding.
6. Maps `PolicyViolationError` to 422 JSON.

### Workflow ID

The client sends `x-workflow-id: <uuid>` on each request. Use the same ID across multi-step flows so tokens stay stable. See Demo 3.

## Demo 3: token stability

```bash
pnpm --filter example-nextjs-ai-sdk demo:3
```

Runs a 50-step loop through `wrapModel`, `wrapTools`, and mixed boundaries. Asserts:

- The same email produces one identical token at steps 1, 17, and 42 (and all 50 steps).
- Egress restore returns the original email.

Exit code 0 means success. No API keys required.

## Ship to Vercel

1. Install the [Vercel CLI](https://vercel.com/docs/cli) or use **Import Git** in the Vercel dashboard.
2. Set project root to `examples/nextjs-ai-sdk` (or deploy from a fork that includes this example).
3. Add environment variables in the Vercel project:
   - `OPENAI_API_KEY` - your OpenAI key
   - `TAILRACE_VAULT_KEY` - a stable secret (for example `openssl rand -base64 32`). Keep the same value across deploys so tokens remain decryptable.
4. Deploy:

```bash
cd examples/nextjs-ai-sdk
vercel
```

5. Verify on the production URL:

```bash
# Expect 422 + entity api_key
curl -s -X POST "https://YOUR_DEPLOYMENT.vercel.app/api/chat" \
  -H 'content-type: application/json' \
  -d '{"prompt":"Use sk_test_51FakeKeyForTailraceTests000FAKE"}' | jq .

# Expect 200, modelSaw with <EMAIL_…>, text with customer@example.com
curl -s -X POST "https://YOUR_DEPLOYMENT.vercel.app/api/chat" \
  -H 'content-type: application/json' \
  -H 'x-workflow-id: ship-verify' \
  -d '{"prompt":"Email customer@example.com"}' | jq .
```

### Production vault note

Within a single request, the default `memoryVault` is enough for Demo 1 tokenize + restore (the vault lives for the request lifetime). For multi-invocation token stability on serverless (same token across separate function invocations), use `kvVault` with a Redis/Upstash shim - a 5-line adapter over `{ get, put, delete }` as described in [`docs/vault.md`](../../docs/vault.md) §2. Ship the shim in your app; Tailrace does not bundle a Redis package.

Example Upstash-shaped shim:

```ts
import { createTailrace, kvVault } from "@tailrace/core";

const redis = /* your Redis / Upstash client */;

const vault = kvVault(
  {
    get: (key) => redis.get(key),
    put: async (key, value, opts) => {
      if (opts?.expirationTtl) {
        await redis.set(key, value, { ex: opts.expirationTtl });
      } else {
        await redis.set(key, value);
      }
    },
    delete: (key) => redis.del(key),
  },
  { key: process.env.TAILRACE_VAULT_KEY! },
);

const tailrace = createTailrace({ vault });
```

Adjust to your client's API; the structural contract is in [`docs/vault.md`](../../docs/vault.md).

## Project layout

```text
app/
  api/chat/route.ts   # Dual-mode agent route (model + tool)
  page.tsx            # Demo 1 UI
lib/
  mock-model.ts       # Echo LanguageModelV2 (no network)
scripts/
  demo-3.ts           # Demo 3 script
.env.example          # OPENAI_API_KEY, TAILRACE_VAULT_KEY
```

## Related docs

- [`@tailrace/ai-sdk` README](../../packages/ai-sdk/README.md)
- [Ship an agent](../../apps/web/content/docs/guides/ship-an-agent-on-vercel.mdx) - full clone → verify → deploy tutorial
