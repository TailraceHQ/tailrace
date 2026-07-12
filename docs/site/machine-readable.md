# Machine-Readable Docs Spec

Goal: an AI agent (a user's Cursor/Claude Code session, or a support bot) can discover, fetch, and correctly apply Tailrace documentation without scraping HTML. Humans get the same artifacts as conveniences.

## 1. llms.txt family

- `/llms.txt` - the index: one-line project description, then a curated link list (title + one-line description + absolute `.md` URL) grouped by IA section. Curated means: quickstart, all guides, all concepts, policy-schema, errors index, integrations. NOT every reference page - keep it under ~60 links so it fits comfortably in a context window as a router.
- `/llms-full.txt` - full concatenated markdown of all docs pages in IA order, with `# <title>` + canonical URL as each section header. Regenerated at build time. If >400KB, split by section (`/llms-guides.txt` etc.) and list the parts in llms.txt.
- Acceptance: both URLs return `text/plain; charset=utf-8`, no HTML, build-generated (never hand-maintained).

## 2. Raw markdown endpoints

- Every docs page is additionally served at `{path}.md` returning the SOURCE MDX rendered down to plain markdown: frontmatter as a heading + description line, tabs flattened with `### <Tab label>` subheadings, twoslash annotations stripped, code fences preserved with language tags.
- `Link` response header on HTML pages advertising the markdown alternate; `<link rel="alternate" type="text/markdown">` in head.
- "Copy page as Markdown" button in every page footer uses the same artifact (no separate serializer to drift).
- Acceptance: `curl /docs/guides/protect-pii-in-ai-sdk.md` returns compiling code fences (twoslash-checked upstream) and zero JSX residue.

## 3. Config JSON Schema

- Publish JSON Schema (draft 2020-12) for the compiled policy document at `/schema/policy.v1.json` (versioned path, stable URL).
- Generated from the TypeScript types (zod-to-json-schema or typescript-json-schema - whichever the config types already suit; if config types are hand-rolled, add a zod mirror and CI-check it against the TS types).
- `tailrace init` writes `"$schema": "https://tailrace.dev/schema/policy.v1.json"` into generated JSON configs so editors and agents validate without docs.
- Acceptance: an intentionally invalid config fails validation against the published schema in a CI test.

## 4. Error messages carry docs URLs

- Every `GateError` message ends with `→ https://tailrace.dev/docs/reference/errors/{CODE}`.
- Those pages exist per the IA doc §2.4 and are in llms.txt.
- Why this matters for machines: an agent that catches PolicyViolationError can fetch the URL and self-correct with the documented fix. Test: error page URLs in messages resolve (CI link check includes constructed error URLs).

## 5. Docs MCP server

- Package: `@tailrace/docs-mcp` (public repo). Tools: `search_docs(query) → [{title, url, snippet}]` over the llms-full corpus (local index bundled at publish time - the server works offline, no API dependency), `get_page(url|slug) → markdown`.
- One-line install docs for Claude Code (`claude mcp add …`) and Cursor on the /docs machine-readable page.
- Keep it dumb: no generation, no summarization - retrieval only. It must never be a support chatbot; it's a filesystem for agents.
- Acceptance: from a clean Claude Code session with the MCP server added, "how do I write a custom recognizer with tailrace?" retrieves the right guide without web access.

## 6. Editor-agent rules artifact (the Better Auth 'Prompt/Skills' move)

- `tailrace init` offers (prompted, and via `--agent-rules` flag) to write a rules file for the detected environment: `.cursor/rules/tailrace.mdc`, `CLAUDE.md` append block (fenced with `<!-- tailrace:start/end -->` markers for idempotent updates), or `AGENTS.md` append.
- Content (~60 lines, generated from a single template in the CLI package): what Tailrace is in 2 sentences · the 4 integration one-liners · the policy config shape in miniature · the top 5 mistakes (e.g. "never call gate.restore at a model boundary - it throws INVARIANT") · links to llms.txt and the schema URL.
- Also publish the same content as an installable Anthropic Skill (follow the current skills packaging convention at implementation time) so `claude` users can add it without our CLI.
- Acceptance: after `tailrace init --agent-rules` in a fixture project, a scripted Claude Code session wires gate.model() into an AI SDK route correctly on the first attempt using only local context.

## 7. Structural hygiene (applies to every page)

- Stable, human-readable heading anchors (kebab-case, never auto-numbered); changing an anchor requires a redirect entry.
- Frontmatter contract: `title` (≤60 chars), `description` (≤160, outcome-phrased), `mode`. These feed llms.txt lines, meta tags, and search - write them as if they're the only thing a router-agent reads, because often they are.
- Canonical URLs everywhere; sitemap.xml includes .md variants with alternate annotations.
- No content behind interaction: anything inside tabs/accordions must appear in the .md rendering.

## 8. Deferred (design for, don't build)

- OpenAPI 3.1 spec for the cloud plane API (belongs with the private repo's launch; reserve /schema/openapi.json)
- Per-version docs and versioned llms.txt (post-1.0)
- context7 / third-party doc-index registrations (do at launch week, not build time - it's a form, not code)
