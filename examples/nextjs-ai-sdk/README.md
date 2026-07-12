# Next.js + @tailrace/ai-sdk

A minimal Next.js app that demonstrates Tailrace at the AI SDK model boundary. It runs **Demo 1** (block a secret, tokenize and restore an email) and **Demo 3** (token stability across 50 steps) from [`docs/milestones.md`](../../docs/milestones.md).

No API keys are required. The default model is an in-process echo mock.

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

## Demo 1: interactive

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

The secret never reaches the mock model. Check the server console: Tailrace audit lines list `entity` and `contentHash`, never the raw key.

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

- `modelSaw` is what the mock provider received after `transformParams` tokenized the email.
- `text` is the egress-restored string your UI displays.

### How it works

The route handler ([`app/api/chat/route.ts`](app/api/chat/route.ts)):

1. Creates a per-request `workflowId` from the `x-workflow-id` header.
2. Wraps a mock echo model with `tailrace.model(...)`.
3. Calls `generateText` - Tailrace scans the prompt before the mock runs.
4. On success, calls `tailrace.restore` at `{ kind: "egress", sink: "ui" }` before responding.
5. Maps `PolicyViolationError` to 422 JSON.

### Workflow ID

The client sends `x-workflow-id: <uuid>` on each request. Use the same ID across multi-step flows so tokens stay stable. See Demo 3.

### Live provider (optional)

Set `DEMO_LIVE=1` and replace `createEchoModel()` with a real provider model. CI always uses the mock.

## Demo 3: token stability

```bash
pnpm --filter example-nextjs-ai-sdk demo:3
```

Runs a 50-step loop through `wrapModel`, `wrapTools`, and mixed boundaries. Asserts:

- The same email produces one identical token at steps 1, 17, and 42 (and all 50 steps).
- Egress restore returns the original email.

Exit code 0 means success.

## Project layout

```text
app/
  api/chat/route.ts   # Demo 1 API
  page.tsx            # Demo 1 UI
lib/
  mock-model.ts       # Echo LanguageModelV2 (no network)
scripts/
  demo-3.ts           # Demo 3 script
```

## Related docs

- [`@tailrace/ai-sdk` README](../../packages/ai-sdk/README.md)
- [Protect PII in the AI SDK guide](../../apps/web/content/docs/guides/protect-pii-in-ai-sdk.mdx)
