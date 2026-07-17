# __PACKAGE_NAME__

OpenAI Agents SDK agent with Tailrace tool wraps (`@tailrace/openai-agents`).

Scaffolded by `tailrace create openai`.

## Setup

```bash
cp .env.example .env
npm install   # or pnpm / yarn
npm run verify
```

| Variable             | When needed                        |
| -------------------- | ---------------------------------- |
| `OPENAI_API_KEY`     | `npm start` (live Agent.run)       |
| `TAILRACE_VAULT_KEY` | Optional; demo key used for verify |

## Verify (offline)

```bash
npm run verify
```

Expects:

- `ok: tokenize email` - tool args get `<EMAIL_…>` tokens
- `ok: block api_key` - synthetic Stripe test key is blocked

No network call. Fixtures: `customer@example.com`, `sk_test_51FakeKeyForTailraceTests000FAKE`.

## Run the agent

```bash
export OPENAI_API_KEY=sk-...
npm start
# or:
npm start -- "Look up customer cust_42 and draft a short reply to their email."
```

`lookup_customer` returns synthetic `customer@example.com`. Tailrace tokenizes that on the tool boundary before it reaches the model context as a result.

## Hosting

Run as a Node process, or wire `agent` into your HTTP host. For Next/Vercel or Cloudflare scaffolds, use `tailrace create next` / `tailrace create cloudflare`.

Docs: [https://tailrace.dev/docs/reference/openai-agents](https://tailrace.dev/docs/reference/openai-agents)
