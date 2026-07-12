# benchmarks

Perf-gate harness. `pnpm bench` runs the benchmarks and fails if any p50 exceeds its
`baseline.json` budget by more than 20% (docs/conventions.md §Performance CI).

- `harness.mjs` - dependency-free runner; measures p50 latency and compares to the baseline.
- `baseline.json` - committed budgets. Update in the same PR that intentionally changes
  performance, with justification in the PR description.

Gates currently enforced:

- `placeholder-4kb-scan` - mechanism / regression sentinel
- `hook-spawn-to-exit` - Claude Code hook spawn-to-exit p50, absolute gate **< 150ms** (M4)
  plus regression vs baseline
