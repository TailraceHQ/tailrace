# __PACKAGE_NAME__

Next.js App Router agent with Tailrace: secrets blocked before the provider, common PII tokenized, restored at egress.

Scaffolded by `tailrace create next`.

## Setup

```bash
cp .env.example .env.local
npm install   # or pnpm / yarn
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Variable             | When needed                           |
| -------------------- | ------------------------------------- |
| `OPENAI_API_KEY`     | Live provider (omit for mock / local) |
| `TAILRACE_VAULT_KEY` | Live and deploy; mock uses a demo key |

## Verify locally

### Run A: block a secret

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"Use sk_test_51FakeKeyForTailraceTests000FAKE"}' | jq .
```

Expect **422** with `"entity": "api_key"`. The secret never reaches the model.

### Run B: tokenize and restore

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -H 'x-workflow-id: local-verify' \
  -d '{"prompt":"Please email customer@example.com about the invoice."}' | jq .
```

Expect **200** with `modelSaw` containing `<EMAIL_…>` and `text` containing `customer@example.com`.

## Deploy (Vercel)

1. Set `OPENAI_API_KEY` and a stable `TAILRACE_VAULT_KEY` in the project env.
2. Deploy from this directory (`vercel` or Import Git with this folder as root).
3. Re-run the curl checks against your production `/api/chat` URL.

Docs: [https://tailrace.dev/docs](https://tailrace.dev/docs)
