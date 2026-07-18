# Documentation Style Guide

Normative for everything under `apps/web/content/docs/` and `docs/*.md`. The bar is
**Stripe docs / Firebase docs**: a reader with zero context can accomplish a task in
under five minutes, and can go arbitrarily deep on any topic without ever being forced
to. If a change to this repo adds or moves a public API, the docs update in the same PR
(see `CONTRIBUTING.md`).

## The standard, made concrete

"Stripe/Firebase quality" isn't a vibe - it's five specific properties:

1. **Task-first, not API-first.** The page title is what the reader is trying to do
   ("Block secrets in an Express app"), not what the code is called
   (`tailraceExpress()`).
2. **Runnable before explained.** A complete, copy-pasteable example appears before
   the paragraph explaining how it works.
3. **One idea per screen.** No wall of text. If a reader has to scroll past something
   to get their answer, it's in the wrong place (see [Progressive disclosure](#progressive-disclosure)).
4. **Nothing asserted without a link.** Every type, error, and config key mentioned in
   a guide links to its entry in reference docs - the guide never becomes the source
   of truth for a signature.
5. **Consistent vocabulary.** The same concept has the same name everywhere. See
   [Terminology](#terminology).

## Two kinds of page

| Kind | Lives in | Job | Optimizes for |
|---|---|---|---|
| **Guide** | `apps/web/content/docs/guides/` | Get one task done | Speed to working code |
| **Reference** | `apps/web/content/docs/reference/` | Look up exact behavior | Completeness, precision |

Guides tell a story and link out. Reference pages are exhaustive and link back to the
guide that motivates them. Never duplicate reference content inside a guide beyond what's
needed to keep the example running - link instead.

## Progressive disclosure

Default to showing only what's needed to succeed at the task. Push everything else one
click away, using whichever mechanism fits:

- **`<Accordions>` / `<Accordion>`** for an in-page deep dive a reader can expand without
  leaving the guide (see `apps/web/content/docs/concepts/policy-resolution.mdx` for a
  live example: `<Accordion title="Deep dive: how resolution stays sub-microsecond">`).
  Use this when the detail is *interesting but not required* to finish the task.
- **A separate reference page** when the detail is *required for some readers, never
  for others* (edge cases, exhaustive option lists, algorithm internals). Link to it
  with a sentence that tells the reader why they'd click, not just "see reference":
  > By default, `workflowId` scopes tokens per request. For multi-turn agents that need
  > tokens to resolve consistently across turns, see [Workflow-scoped tokenization](/docs/reference/vault#workflow-scope).
- **`<Cards>`** when the reader has to choose a path before continuing (which framework,
  which auth mode). One card per option, one sentence of description each - the card
  title carries the decision, not the prose beneath it.

Never nest more than one level of disclosure. If an accordion needs its own accordion,
that content belongs on its own reference page instead.

## Page anatomy

Every guide follows this order. Skip a section only if it's genuinely empty for that
page - don't pad it.

1. **H1** - the task, in the reader's words ("Send data to Slack", not "Slack integration").
2. **One-sentence description** directly under the H1 - what the reader will have
   working by the end. This becomes the page's search/preview snippet, so it has to
   stand alone.
3. **Prerequisites** - as a short bullet list, only if there's more than "installed the
   package."
4. **The complete, runnable example** - see [Code examples](#code-examples).
5. **How it works** - the minimum explanation needed to trust and modify the example.
   Deep dives go in accordions or link out, per above.
6. **Common variations** - the 2-3 things readers actually ask about next (error
   handling, a config knob, a second framework). Each gets its own `##` so it's
   independently linkable.
7. **See also** - links to reference docs and related guides. Always present, always last.

Reference pages drop 1-2 (task framing) in favor of a one-line summary of what the
symbol/endpoint does, then move straight into signature, parameters/options table,
return value, errors, and examples.

## Voice and tone

- **Second person, active voice, present tense.** "The middleware blocks the request,"
  not "The request will be blocked by the middleware."
- **Imperative for instructions.** "Install the package," not "You should install the
  package" or "The package needs to be installed."
- **Say what happens, not what the software is designed to do.** "This throws
  `PolicyViolationError`," not "This is designed to throw an error in these cases."
- **No filler.** Cut "simply," "just," "easily," "obviously," "in order to," "please
  note that." If a step were actually simple, the reader wouldn't be reading the
  sentence.
- **No unearned enthusiasm.** No exclamation points, no "Congratulations!," no marketing
  adjectives ("powerful," "seamless," "blazing fast") in technical prose. Confidence
  comes from correctness and specificity, not tone.
- **Address one reader, not a class.** "You" singular. Never "users" or "developers"
  when "you" reads naturally.
- **Name the failure before the fix.** When documenting error handling, state exactly
  what triggers the error before showing how to handle it.

| Instead of | Write |
|---|---|
| "You can optionally pass a `workflowId` if you want to scope tokens." | "Pass `workflowId` to scope tokens per conversation." |
| "This should work in most cases." | "This works for JSON and SSE responses. For raw byte streams, see [...]." |
| "Simply call `check()` and you're done!" | "Call `check()` before forwarding the request." |
| "An error will be thrown if the input is invalid." | "Throws `PolicyValidationError` if the input is invalid." |

## Code examples

- **Complete and runnable**, not fragments. A reader should be able to paste it in and
  run it, including imports. If truncating for length, mark it explicitly
  (`// ...`) rather than silently dropping lines.
- **Realistic, not contrived.** Use the actual shapes this repo works with (a chat
  completion body with a `sk_test_...FAKE` key, not `foo`/`bar`). Fixture values follow
  `docs/conventions.md` (`4242` cards, `555` phones, `example.com` emails).
- **Minimal.** Show the one thing the section is teaching. Config unrelated to the
  point being made should use its default and stay out of the snippet.
- **One canonical language/framework per concept, tabs for the rest.** Write the primary
  example once, then give every other supported framework its own tab with
  `<CodeBlockTabs>` / `<CodeBlockTab>` rather than repeating the surrounding prose per
  framework:

  ```mdx
  <CodeBlockTabs items={["Express", "Fastify", "Hono"]}>
    <CodeBlockTab value="Express">
    ```ts
    app.use("/v1", tailraceExpress(tailrace));
    ```
    </CodeBlockTab>
    <CodeBlockTab value="Fastify">
    ```ts
    await app.register(tailraceFastify(tailrace));
    ```
    </CodeBlockTab>
  </CodeBlockTabs>
  ```
- **Type-checked where it matters.** Public API examples should compile under Twoslash
  (already wired via `fumadocs-twoslash`) so a signature change breaks the docs build
  instead of silently going stale.
- **Comment the non-obvious line only.** Don't caption every line - one comment on the
  line a reader might trip on, nothing on the rest.

## Visuals and diagrams

Reach for a visual when prose would require the reader to hold more than ~3 steps or
branches in their head - request/response flows, state machines, package dependency
direction, decision trees. Don't add one to decorate a page that's already clear in
text.

- **`<Mermaid>`** for flows, sequence diagrams, and dependency graphs. Prefer this over
  a static image: it's diffable in review and stays a11y-friendly as text.
- **`<FlowDemo>`** for anything worth letting the reader step through interactively
  (e.g. watching a request move through detect → resolve → apply → audit). Use it when
  the *sequence* is the point, not just the shape.
- **`<Playground>`** when the fastest way to build intuition is to let the reader change
  an input and see the output change (a policy config, a piece of text to scan).
- **Static images/screenshots** only for literal UI (a dashboard, a CLI screenshot).
  Always give them real alt text describing what the image shows, not the filename.
- Every diagram gets one sentence of prose immediately before it stating what it shows,
  so it still makes sense to a screen reader or a skim.

## Callouts

Use `<Callout>` sparingly and only for its intended type - readers pattern-match on
color/icon, so misuse trains them to ignore callouts entirely:

- **Note** - context that's easy to miss but not consulting it won't break anything.
- **Warning** - skipping this will cause a bug, security issue, or data loss (e.g. "restore only works at egress boundaries").
- **Tip** - an optional shortcut or better way for advanced readers.

Never put required steps inside a callout - if it's required, it belongs in the numbered
flow of the page, not a box beside it.

## Linking to reference docs

- Every non-trivial type, function, error class, or config key named in a guide is a
  link on first mention in that section, target `apps/web/content/docs/reference/...`.
- Link text is the symbol name, not "here" or "this page": "throws
  [`PolicyViolationError`](/docs/reference/errors#policyviolationerror)," never "see
  [here](...) for the error."
- Reference pages link back to the guide(s) that use them under a "Used in" or "See
  also" line - reference is exhaustive but shouldn't be a dead end.
- Cross-package links go through the published site path, not repo-relative `.md`
  paths (those only resolve for readers browsing GitHub, not the docs site).

## Terminology

Pick one term per concept and use it everywhere - guides, reference, error messages,
code comments. Check `docs/architecture.md` and `docs/policy-engine.md` for the
canonical term before introducing a new one. Do not introduce a synonym for variety;
inconsistent naming is the single fastest way to make a reader distrust the docs.

Examples already locked in this repo - don't drift from these:

| Use | Not |
|---|---|
| boundary | destination, sink, target |
| identity | actor, principal, caller |
| tokenize | mask, redact (redact is a real, different action - keep them distinct) |
| block | reject, deny |
| workflow | session, conversation (unless the framework's own term) |

## Formatting mechanics

- Headings: sentence case ("Configure the vault," not "Configure The Vault").
- One `##` per linkable idea; readers and search both navigate by heading, so don't
  bury a distinct topic as a paragraph under an unrelated heading.
- Prefer numbered lists for sequences, bullets for unordered facts, tables for anything
  with more than one attribute per item (options, parameters, error codes).
- Sentences short enough to read once. If a sentence needs a comma-separated list of
  more than two clauses, it's a bulleted list instead.
- Don't bold for emphasis in running prose - bold is reserved for UI labels and the
  first mention of a defined term. Overuse defeats its own purpose.

## Editing checklist

Before merging a docs change, confirm:

- [ ] The H1 names a task or a symbol, not a category ("Errors," "Configuration").
- [ ] A complete example appears before the explanation.
- [ ] Anything a reader might skip is genuinely skippable (accordion/linked page), not
      just visually de-emphasized while still blocking the main flow.
- [ ] Every type/error/config key named is linked to its reference entry.
- [ ] Terms match `docs/architecture.md` / `docs/policy-engine.md` / this file's
      [Terminology](#terminology) table.
- [ ] No filler words, no exclamation points, no unearned adjectives.
- [ ] Fixture values are synthetic per `docs/conventions.md`.
- [ ] `pnpm turbo run build --filter=@tailrace/web...` succeeds (catches broken
      Twoslash examples and broken links).
