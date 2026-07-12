# DOCS_AGENTS.md: Documentation Site Build Instructions (Master Prompt)

You are building the documentation and marketing site for Tailrace (working name; npm scope `@tailrace/*`), the TypeScript-native agent data governance library. The library's own specs live in the repo's existing `docs/*.md` kit - read `AGENTS.md` first for the product's prime directives; they apply here too.

This site lives at `apps/web` INSIDE the public monorepo. It is one Next.js app serving both marketing pages and `/docs`. There is no separate docs repo and no docs subdomain.

## Companion specs (normative)

| File | Specifies |
|---|---|
| docs/site/information-architecture.md | Full page tree, page templates per content type, writing rules |
| docs/site/machine-readable.md | llms.txt, .md endpoints, JSON schema, MCP server, agent artifacts |

## Prime directives for this workstream

1. **Every code block compiles.** All TypeScript snippets in MDX use twoslash and are type-checked in CI against the actual workspace packages (`@tailrace/*` via workspace protocol). A docs build with a broken snippet FAILS. No pseudo-code in code blocks - pseudo-code goes in prose or diagrams.
2. **Reference never drifts.** Options/config tables are rendered from source types via fumadocs-typescript AutoTypeTable, not hand-copied. Hand-written prose describes behavior; generated tables describe shape.
3. **Four content modes, never mixed** (Diátaxis): tutorial (Get Started), how-to (Guides), explanation (Concepts), reference (Reference). A page declares its mode in frontmatter. If you feel the urge to explain theory inside a how-to, link to a Concept page instead.
4. **Every page is agent-consumable**: raw markdown at `{path}.md`, stable heading anchors, frontmatter with `title` + `description`, present in llms.txt. See machine-readable.md.
5. **Framework switcher, not framework forks.** One guide with `<Tabs>` for AI SDK / Hono / Claude Code variants, selection persisted globally (localStorage) and reflected in URL query. Never three near-duplicate pages.
6. **No screenshots of code, no screenshots of terminals.** Text renders, screenshots rot.
7. Marketing pages are secondary to docs quality. Build docs first (milestones below).

## Stack (do not substitute)

- Next.js (App Router) + Fumadocs (fumadocs-ui, fumadocs-mdx) in `apps/web`
- fumadocs-typescript for AutoTypeTable; twoslash via Fumadocs' Shiki transformer for typed, compile-checked code blocks
- Search: Fumadocs built-in (Orama) - no external search service in v1
- Content lives in `apps/web/content/docs/**.mdx`; marketing pages in `apps/web/app/(marketing)/`
- Deployed on Vercel. Zero server-side data dependencies - the whole site must render statically.

NOTE: verify current Fumadocs setup APIs against its live documentation at implementation time; the framework moves quickly. Record drift by updating this kit in the same PR.

## Milestones

**D0 - Scaffold**: apps/web with Fumadocs wired into the monorepo (Turborepo task graph: docs build depends on package builds); twoslash pipeline proving a snippet that imports `@tailrace/core` type-checks in CI; one placeholder page per top-level IA section; CI deploy previews on PRs.

**D1 - Get Started + core Guides**: the 5-minute quickstart (per IA doc §2.1) working end-to-end with copy-paste blocks; the four launch guides (secrets in Claude Code, PII in AI SDK, MCP boundary policies, tokenization+restore). Acceptance: a new developer following only the quickstart reaches a blocked fake Stripe key in under 5 minutes from `pnpm create`/`npx` to running.

**D2 - Reference**: every public export of every package gets a reference page per the IA template; policy schema reference; CLI reference; the error registry with one page per error code at stable URLs matching the codes in `core/src/errors.ts`. Acceptance: `grep` the public API surface (index.ts exports) against reference slugs - 100% coverage, zero orphan pages.

**D3 - Concepts + playground**: the five concept pages (IA §2.3); the browser playground (Tier 0 engine bundled client-side; paste text → highlighted spans → toggling policy actions re-renders). Acceptance: playground works offline after load, ships no analytics of pasted content - add a visible note saying scanning is 100% client-side (this is a trust feature, treat it as such).

**D4 - Machine-readable layer**: everything in machine-readable.md - llms.txt, llms-full.txt, `.md` endpoints, copy-as-markdown, JSON schema published, config-schema URL wired into the CLI's generated config, docs MCP server, agents-rules artifact behind `tailrace init`. Acceptance criteria are listed per-item in that doc.

**D5 - Marketing shell**: landing page (hero = real config file + `npx @tailrace/cli init` one-liner, Better Auth-style), integrations grid (one card per adapter linking to its guide), comparison page (vs Python proxy stack - factual, no FUD: deployment model table), changelog page fed by changesets.

## Writing style

- Second person, present tense, active voice. "Tailrace blocks the call" not "the call will be blocked by Tailrace."
- Lead every page with the outcome, not the architecture.
- Sentence-case headings. No marketing adjectives inside /docs (no "powerful", "seamless", "blazing").
- Code-first: in Guides, show the code before explaining it - developers read the block first anyway.
- Use fake-but-realistic values everywhere per the repo's fixture rules (sk_test_FAKE… keys, 4242 cards, example.com emails). NEVER a plausible real secret, even as an example of what gets blocked.

## When uncertain

Same protocol as the main kit: prefer the smaller page count, leave `// SPEC-QUESTION:` in MDX comments, log to OPEN_QUESTIONS.md. Do not invent new IA sections without updating the IA doc in the same PR.
