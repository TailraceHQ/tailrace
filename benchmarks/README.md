# benchmarks

Perf-gate harness. `pnpm bench` runs the benchmarks and fails if any p50 exceeds its
`baseline.json` budget by more than 20% (docs/conventions.md §Performance CI).

- `harness.mjs` - dependency-free runner; measures p50 latency and compares to the baseline.
- `baseline.json` - committed budgets. Update in the same PR that intentionally changes
  performance, with justification in the PR description.

M0 ships a single placeholder benchmark to prove the mechanism. The real Tier 0 budgets
(4KB scan p50 < 5ms, policy resolve < 1µs/span, hook spawn-to-exit p50 < 150ms) land alongside
their milestones.
