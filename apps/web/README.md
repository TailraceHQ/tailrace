# @tailrace/web

Docs and marketing site for Tailrace. Next.js + Fumadocs in the public monorepo (`docs/site/DOCS_AGENTS.md`).

## Commands

```bash
# from repo root
pnpm --filter @tailrace/web dev
pnpm --filter @tailrace/web build
```

`dev` runs `fumadocs-mdx` first (generates `apps/web/.source/` for `collections/server`) and uses Webpack instead of Turbopack so Tailwind's PostCSS stack loads the correct `lightningcss` native binding on Apple Silicon.

Docs build depends on workspace packages (`@tailrace/core`) so twoslash snippets type-check against real types.

## Machine-readable docs

After `pnpm --filter @tailrace/web build && pnpm --filter @tailrace/web start`:

| URL | Purpose |
| --- | --- |
| `/llms.txt` | Curated agent index (absolute `.md` links) |
| `/llms-full.txt` | Full concatenated markdown corpus |
| `/docs/....md` | Per-page plain markdown |
| `/mcp` | HTTP MCP (`search_docs`, `get_page`, `list_sections`) |
| `/schema/policy.v1.json` | Policy JSON Schema |

Connect guide: `/docs/get-started/use-with-ai-tools`.

## Troubleshooting

### Check Node architecture

Native module errors often mean Node's arch does not match the installed `lightningcss` binary:

```bash
node -p "process.platform + ' ' + process.arch"
sysctl -n sysctl.proc_translated   # 1 = Rosetta (x64), 0 = native arm64
ls node_modules/.pnpm | rg 'lightningcss-darwin'
```

You want `process.arch` to match what you use consistently (`arm64` on Apple Silicon is ideal). If the terminal runs under Rosetta (`proc_translated=1`), Node reports `x64` and needs `lightningcss-darwin-x64`. The repo `.npmrc` installs both arm64 and x64 optional packages - run `pnpm install` from the repo root so both are present, or switch the terminal/IDE to native arm64 and reinstall.

### Clear caches

If dev fails after clearing caches, regenerate Fumadocs output and wipe Next caches:

```bash
rm -rf apps/web/.next apps/web/.source apps/web/.turbo .turbo
pnpm --filter @tailrace/web dev
```
