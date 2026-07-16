# Docs Information Architecture

Every page declares `mode: tutorial | guide | concept | reference | integration` in frontmatter. Navigation order below is the sidebar order.

## 1. Page tree (v1 launch scope: build exactly this, nothing more)

```
/docs
├── Get Started
│   ├── quickstart                    # THE tutorial (§2.1)
│   └── use-with-ai-tools             # MCP / llms.txt / .md connect matrix
├── Guides                            # task-shaped; framework tabs where applicable
│   ├── ship-an-agent-on-vercel
│   ├── block-secrets-in-claude-code
│   ├── govern-mcp-tool-calls
│   ├── tokenize-and-restore          # incl. workflow ids & egress sinks
│   ├── write-custom-recognizers
│   ├── per-agent-policies
│   └── audit-events                  # sinks, OTel, what's in an event
├── Concepts
│   ├── boundaries                    # model/tool/mcp/telemetry/egress - the mental model
│   ├── policy-resolution             # precedence, secrets-can't-be-allowed, worked examples
│   ├── tokenization-and-the-vault    # determinism, format-preserving, TTL, encryption
│   ├── detection-tiers               # what tier 0/1 are, honest accuracy expectations
│   └── threat-model                  # what tailrace does and does NOT protect against
├── Reference
│   ├── core/                         # one page per public export (createGate, definePolicy, …)
│   ├── policy-schema                 # full annotated schema + JSON Schema link
│   ├── ai-sdk/  · mcp/  · hono/     # one page per adapter export
│   ├── cli                           # every command, every flag
│   ├── errors/                       # one page PER ERROR CODE (§2.4)
│   └── recognizers                   # built-in entity classes table: patterns, validators, confidence
├── Integrations                      # the marketing-engine grid; one page per framework
│   ├── nextjs · hono · claude-code · claude-agent-sdk · node
└── Playground                        # interactive Tier 0 demo (top-level nav item)
```

Explicitly deferred (do not scaffold): /docs/cloud (paid plane), versioned docs, self-hosting, comparisons inside /docs.

## 2. Page templates

### 2.1 Quickstart (the one tutorial)
Target: blocked secret in <5 minutes. Structure, exactly:
1. One sentence of what you'll build: "an AI SDK route that blocks secrets and tokenizes emails."
2. Install block (pnpm/npm/bun tabs).
3. `npx @tailrace/cli init` → show the generated config with 4–6 inline comments max.
4. Wrap the model (one line, twoslash).
5. Trigger it: a curl/snippet containing a fake key → show the exact PolicyViolationError output the reader will see. Seeing the block IS the payoff; don't skip the failure screenshot-in-text.
6. Second payoff: email in, token out, restored in response.
7. "Where next" - exactly three links (one guide, one concept, reference index).
No theory. Every block copy-paste-able in order with zero edits except an API key they don't need (local-only demo preferred).

### 2.2 Guide template (how-to)
Frontmatter: mode, title ("Verb the thing": "Block secrets in Claude Code"), description (≤160 chars, outcome-phrased).
Body: (a) 2-sentence outcome + when you'd want this; (b) prerequisites as links; (c) numbered steps, code-first, each step ≤1 concept; (d) "verify it works" section with expected output; (e) troubleshooting accordion for the 2–3 real failure modes; (f) related links. Framework variance handled with `<Tabs>` synced to the global switcher - never sibling pages.

### 2.3 Concept template (explanation)
Opens with the question the page answers ("Why does the same email become the same token?"). Diagrams over prose where flow is involved (Mermaid/SVG, no images-of-text). Ends with "see it in practice" links to guides. No steps, no installs.

### 2.4 Error reference pages (Stripe pattern: high leverage)
URL: /docs/reference/errors/{CODE} for every code in core's error taxonomy (POLICY_VIOLATION, POLICY_INVALID, INVARIANT, VAULT, RECOGNIZER, NOT_IMPLEMENTED - keep in lockstep with errors.ts; CI check greps codes against slugs).
Each page: what it means · the exact message shape · most common causes ranked · the fix for each, with code · whether it's safe to catch-and-continue. The library's error messages include these URLs; agents and humans both land here mid-incident. These pages are written for someone currently broken: terse, fix-first.

### 2.5 Reference pages (API)
One page per public export. Hand-written: one-paragraph behavior description, minimal twoslash example, gotchas. Generated: parameter/option tables via AutoTypeTable pointed at the real types. Returns + throws sections mandatory (throws links to error pages). No narrative - that's what guides are for.

### 2.6 Integration pages
Template: hero snippet (the ≤10-line quickstart for THAT framework) · what's covered at which boundary in a table · link to the relevant guides · a runnable example dir link. These pages are SEO entries ("<framework> PII redaction") - titles and descriptions written for the search, body identical in rigor to guides.

## 3. Global UI requirements

- Three-pane layout on desktop: nav / prose / on-page ToC. Code blocks: copy button, filename label, twoslash hovers, diff highlighting where before/after.
- Global framework switcher (AI SDK · Hono · Claude Code · Node) in the header; persists in localStorage; deep-linkable via ?fw= param.
- Search: keyboard-first (⌘K). Index headings + descriptions.
- Dark mode default (audience skew), light supported.
- Every page footer: "Edit this page" → GitHub, "Copy page as Markdown", last-updated from git.

## 4. Quality gates (CI)

- twoslash compile check on all snippets (build fails on type error)
- Link checker (internal 404s fail build)
- Error-code ↔ error-page lockstep check
- Reference coverage check: public exports vs reference slugs
- Lighthouse budget on /docs/quickstart: ≥95 performance (docs that load slow don't get read)
