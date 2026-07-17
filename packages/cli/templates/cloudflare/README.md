# __PACKAGE_NAME__

Cloudflare Worker agent with Tailrace: `createCloudflareTailrace` + `withCloudflareAgents().forChat`, KV vault binding.

Scaffolded by `tailrace create cloudflare`.

## Setup

```bash
cp .env.example .dev.vars
npm install   # or pnpm / yarn
npm run verify
npm run dev
```

| Variable / binding   | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `TAILRACE_VAULT` KV  | Durable vault (required for multi-isolate) |
| `TAILRACE_VAULT_KEY` | Encryption key (secret)                    |
| `OPENAI_API_KEY`     | Live provider (omit for mock echo)         |

Create a real KV namespace and update `wrangler.toml` ids:

```bash
npx wrangler kv namespace create TAILRACE_VAULT
npx wrangler kv namespace create TAILRACE_VAULT --preview
```

## Verify locally

Offline (no Wrangler):

```bash
npm run verify
```

With `wrangler dev` running:

### Run A: block a secret

```bash
curl -s -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"Use sk_test_51FakeKeyForTailraceTests000FAKE"}' | jq .
```

Expect **422** with `"entity": "api_key"`.

### Run B: tokenize and restore

```bash
curl -s -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -H 'x-workflow-id: local-verify' \
  -d '{"prompt":"Please email customer@example.com about the invoice."}' | jq .
```

Expect **200** with `modelSaw` containing `<EMAIL_…>` and `text` containing `customer@example.com`.

## Deploy

```bash
npx wrangler secret put TAILRACE_VAULT_KEY
npx wrangler secret put OPENAI_API_KEY   # optional for live model
npm run deploy
```

Docs: [https://tailrace.dev/docs/integrations/cloudflare-agents](https://tailrace.dev/docs/integrations/cloudflare-agents)
