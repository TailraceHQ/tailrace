# Conventions

## TypeScript
- `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
- No `any` in public API; internal `any` requires a `// why:` comment
- Public functions get TSDoc with one usage example
- ESM-first source; tsup emits dual ESM/CJS; `exports` maps with types condition

## Error taxonomy (core/src/errors.ts)
All errors extend `GateError { code: string }`:
- `PolicyViolationError` (code `POLICY_VIOLATION`, carries `decisions: Decision[]`)
- `PolicyValidationError` (`POLICY_INVALID`, carries key path)
- `InvariantViolationError` (`INVARIANT`) — internal contract breaches, e.g. restore at a non-egress boundary
- `VaultError` (`VAULT`), `RecognizerError` (`RECOGNIZER`)
- `NotImplementedError` (`NOT_IMPLEMENTED`)
Error messages NEVER contain detected values — enforced by a test that scans all thrown messages in the suite against fixture values.

## Testing
- Vitest; unit tests colocated (`*.test.ts`), integration tests in `package/tests/`
- Property-based tests (fast-check) required for: policy resolution precedence, span merging, token determinism, streaming carry buffer
- Type-level tests via `expect-type` for all wrapper APIs
- Core suite runs in both Node and workerd pools in CI
- Coverage gate: 90% lines on core/src/policy and core/src/vault; 80% elsewhere

## Performance CI
- /benchmarks uses vitest bench or tinybench; results compared against `benchmarks/baseline.json` committed in repo
- Gates: Tier 0 4KB scan p50 < 5ms; policy resolve < 1µs/span; hook spawn-to-exit p50 < 150ms; core gzip < 60KB (via size-limit)
- Regressions > 20% over baseline fail CI; intentional changes update baseline in the same PR with justification in the description

## Security hygiene
- All fixture secrets/PII are synthetic (use documented fake ranges: 4242… cards, 555 phones, example.com emails, `sk_test_` style keys with FAKE marker suffix)
- No telemetry, no network calls, no postinstall scripts in any package
- `pnpm audit` in CI; zero prod deps in core makes this mostly moot — keep it that way

## Git & releases
- Conventional commits; changesets for versioning; packages version independently
- PR template asks: which milestone, which acceptance criteria affected, perf impact
- `main` is protected by the full CI matrix

## Agent workflow notes
- Before implementing against an external API surface (AI SDK middleware signature, MCP SDK transports, Claude Code hook JSON contract), read the CURRENT docs/source of the installed version — these move fast; the specs in this kit describe intent, the live interface wins on mechanics. Record any drift you find by updating the relevant doc in the same PR.
- Keep PRs scoped to one milestone checkbox where practical
- Never commit a real credential, even expired; CI runs `gate scan` on the diff once M4 lands (dogfood)
