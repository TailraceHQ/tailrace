# @tailrace/web

Docs and marketing site for Tailrace. Next.js + Fumadocs in the public monorepo (`docs/site/DOCS_AGENTS.md`).

## Commands

```bash
# from repo root
pnpm --filter @tailrace/web dev
pnpm --filter @tailrace/web build
```

Docs build depends on workspace packages (`@tailrace/core`) so twoslash snippets type-check against real types.
