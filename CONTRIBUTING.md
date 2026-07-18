# Contributing to Tailrace

Thank you for your interest in Tailrace. This guide covers local setup, development workflow, and what we look for in pull requests.

For AI coding agents, [`AGENTS.md`](AGENTS.md) is the master build prompt. Human contributors should start here; refer to `AGENTS.md` and the specs in [`docs/`](docs/) when implementing behavior.

## Getting help

- **Bugs and feature requests:** [GitHub Issues](https://github.com/TailraceHQ/tailrace/issues)
- **Docs:** [tailrace.dev](https://tailrace.dev) (run locally with `pnpm --filter @tailrace/web dev`)
- **Specs:** Normative design docs live in [`docs/`](docs/). When a spec and the code disagree, the spec wins until the PR updates the spec.

## Prerequisites

- **Node.js** 20 or later
- **pnpm** 10 (the repo pins `pnpm@10.18.0` via `packageManager` in the root `package.json`; [Corepack](https://nodejs.org/api/corepack.html) is recommended)

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
```

## Getting started

```bash
git clone https://github.com/TailraceHQ/tailrace.git
cd tailrace
pnpm install
pnpm build
pnpm test
```

Common commands:

| Command                             | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm build`                        | Build all packages (tsup: ESM + CJS + `.d.ts`)  |
| `pnpm test`                         | Run Vitest across the monorepo                  |
| `pnpm test:workers`                 | Run `@tailrace/core` tests under workerd        |
| `pnpm lint`                         | ESLint (includes package boundary rules)        |
| `pnpm format` / `pnpm format:check` | Prettier                                        |
| `pnpm typecheck`                    | TypeScript project references                   |
| `pnpm bench`                        | Performance gates vs `benchmarks/baseline.json` |
| `pnpm size`                         | Core bundle size gate                           |

Pre-commit hooks (Husky + lint-staged) run ESLint and Prettier on staged files. Fix any failures before pushing.

## Project structure

Tailrace is a **pnpm + Turborepo** monorepo. Package boundaries and the runtime matrix are defined in [`docs/architecture.md`](docs/architecture.md).

| Path                      | Role                                                      |
| ------------------------- | --------------------------------------------------------- |
| `packages/core`           | Detection, policy engine, vault, audit (`@tailrace/core`) |
| `packages/*`              | Host integrations (AI SDK, MCP, Hono, CLI, etc.)          |
| `packages/recognizer-ner` | Optional Tier 1 ONNX recognizer (Node only)               |
| `apps/web`                | Docs and marketing site                                   |
| `examples/`               | Runnable demos                                            |
| `benchmarks/`             | CI performance harness                                    |
| `docs/`                   | Normative specs                                           |

Integrations depend on `@tailrace/core` and their host framework as a **peer dependency**. They contain no policy logic: they construct boundaries, call `tailrace.check` / `tailrace.restore`, and translate errors.

## How to contribute

1. **Check existing issues** or open a new one to discuss larger changes before investing significant time.
2. **Fork** the repo and create a feature branch from `main`.
3. **Make focused changes.** Prefer one logical change per PR (one bug fix, one feature, one refactor).
4. **Follow the build order** in [`docs/milestones.md`](docs/milestones.md) for new features. Within a milestone: public API types first, then tests, then implementation.
5. **Run the full local check** before opening a PR:

   ```bash
   pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:workers
   ```

   If you touch performance-sensitive code, also run `pnpm bench` and `pnpm size`.

6. **Open a pull request** against `main` and fill in the [PR template](.github/pull_request_template.md).

CI runs lint, format, typecheck, tests (Node + Workers), bundle size, benchmarks, docs build, and dependency review on every PR.

## Code guidelines

See [`docs/conventions.md`](docs/conventions.md) for the full list. Highlights:

- **TypeScript strict mode** with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
- **No `any` in public APIs.** Internal `any` requires a `// why:` comment.
- **Public functions** get TSDoc with one usage example.
- **Conventional commits** for clear history.
- **Package boundaries:** import only from public entry points; ESLint enforces `no-restricted-imports`.
- **`@tailrace/core` is edge-safe:** no `node:` imports, no `Buffer`, WebCrypto only, no filesystem access.

### Prime directives

These are non-negotiable design constraints:

1. **In-process only** - no proxy, sidecar, or network call in the request hot path.
2. **Fail closed for `block`, fail open for availability** - optional Tier 1 models degrade to Tier 0 with a warning.
3. **Zero required config** - `createTailrace()` with no args enforces sensible defaults.
4. **Never log raw sensitive values** - audit events, errors, and test fixtures use synthetic data only.
5. **Performance budgets are CI gates** - Tier 0 scan, bundle size, policy resolve, and hook latency are measured in CI.

## Testing

- Unit tests are colocated as `*.test.ts`; integration tests live in `package/tests/`.
- **`@tailrace/core` must pass under both Node and workerd** in CI.
- **Property-based tests** (fast-check) are required for policy resolution precedence, span merging, token determinism, and streaming carry buffer behavior.
- **Type-level tests** via `expect-type` for wrapper APIs.
- **Coverage gates:** 90% lines on `core/src/policy` and `core/src/vault`; 80% elsewhere.

Use synthetic fixture values only: `4242…` cards, `555` phones, `example.com` emails, `sk_test_…FAKE` keys. Never commit real credentials.

## Pull requests

Good PRs include:

- A clear description of **what** changed and **why**.
- Test coverage for new behavior or bug fixes.
- A [changeset](#versioning-and-releases) when a publishable package's public API or behavior changes.
- Spec doc updates when behavior diverges from or clarifies existing specs.
- Benchmark baseline updates (with justification in the PR description) when performance changes are intentional.

Mark whether the change is user-facing in the PR template. For docs-only changes, verify the site builds: `pnpm turbo run build --filter=@tailrace/web...`.

## Versioning and releases

Packages under `packages/*` version **independently** via [Changesets](https://github.com/changesets/changesets).

When your PR changes a publishable package:

```bash
pnpm changeset
```

Select the affected packages and bump type (patch/minor/major). Maintainers run `pnpm changeset version` and `pnpm release` at release time. See the [Releasing](README.md#releasing) section in the README for the full runbook.

## Performance and benchmarks

Regressions greater than 20% over `benchmarks/baseline.json` fail CI. If you intentionally change performance characteristics, update the baseline in the same PR and explain why in the description.

Key budgets:

- Tier 0 4KB scan p50 &lt; 5ms
- Core bundle &lt; 60KB gzipped
- Policy resolve &lt; 1µs/span
- CLI hook spawn-to-exit p50 &lt; 150ms

## What we are not looking for (v0.1)

Please do not open PRs for items listed as explicit non-goals in [`AGENTS.md`](AGENTS.md), including:

- Prompt-injection or content-safety detection
- Proxy/gateway deployment mode
- Python SDK
- Policy plane server or hosted dashboard
- Human-in-the-loop `review` action (the type exists; implementation is deferred)

If you are unsure whether a change fits scope, open an issue first.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
