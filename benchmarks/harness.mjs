// Perf-gate harness (docs/conventions.md §Performance CI).
//
// M0 runs a single placeholder benchmark and enforces the regression threshold against
// benchmarks/baseline.json - this proves the mechanism exists and fails CI on regression.
// Real Tier 0 benchmarks replace the placeholder in M1.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(here, "baseline.json"), "utf8"));

// docs/conventions.md: regressions > 20% over baseline fail CI.
const REGRESSION_TOLERANCE = 1.2;

/** Measure the p50 latency (ms) of `fn` over `iterations` samples, after a warmup. */
function measure(name, fn, iterations = 2000) {
  for (let i = 0; i < 200; i++) fn();
  const samples = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples[i] = performance.now() - t0;
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  return { name, p50 };
}

// Placeholder workload: a scan-shaped regex sweep over a 4KB input.
const input = "sk_test_FAKE0123456789 ".repeat(200).slice(0, 4096);
const pattern = /sk_(?:test|live)_[A-Za-z0-9]+/g;

const results = [
  measure("placeholder-4kb-scan", () => {
    pattern.lastIndex = 0;
    let matches = 0;
    while (pattern.exec(input) !== null) matches++;
    return matches;
  }),
];

let failed = false;
for (const { name, p50 } of results) {
  const budget = baseline.benchmarks?.[name]?.p50Ms;
  const overBudget = budget != null && p50 > budget * REGRESSION_TOLERANCE;
  if (overBudget) failed = true;
  const label = budget != null ? `${budget}ms baseline` : "no baseline";
  console.log(`[${overBudget ? "FAIL" : "ok"}] ${name}: p50=${p50.toFixed(4)}ms (${label})`);
}

if (failed) {
  console.error(
    `\nBenchmark regressed >${((REGRESSION_TOLERANCE - 1) * 100).toFixed(0)}% over baseline. ` +
      "If intentional, update benchmarks/baseline.json in this PR with justification.",
  );
  process.exit(1);
}

console.log("\nAll benchmarks within budget.");
