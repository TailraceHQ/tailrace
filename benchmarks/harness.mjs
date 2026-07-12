// Perf-gate harness (docs/conventions.md §Performance CI).
//
// Gates: placeholder / Tier 0 scan, plus hook spawn-to-exit p50 < 150ms (M4).
// Regressions > 20% over baseline.json fail CI.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const baseline = JSON.parse(readFileSync(join(here, "baseline.json"), "utf8"));

// docs/conventions.md: regressions > 20% over baseline fail CI.
const REGRESSION_TOLERANCE = 1.2;
/** Absolute gate from milestones.md §M4 (spawn-to-exit p50). */
const HOOK_ABSOLUTE_P50_MS = 150;

/** Measure the p50 latency (ms) of sync `fn` over `iterations` samples, after a warmup. */
function measure(name, fn, iterations = 2000, warmup = 200) {
  for (let i = 0; i < warmup; i++) fn();
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

// --- M4: hook spawn-to-exit ---
const cliPath = join(root, "packages/cli/dist/cli.cjs");
const hookProject = mkdtempSync(join(tmpdir(), "tailrace-hook-bench-"));
mkdirSync(join(hookProject, ".tailrace"), { recursive: true });
writeFileSync(
  join(hookProject, ".tailrace", "config.json"),
  JSON.stringify(
    {
      version: 1,
      agent: "claude-code",
      vaultKey: "bench-vault-key-not-a-secret",
    },
    null,
    2,
  ),
);

const emailPad = "x".repeat(800);
const hookStdin = JSON.stringify({
  hook_event_name: "PreToolUse",
  session_id: "bench-session",
  tool_name: "Bash",
  tool_input: {
    command: `echo contact=${"user@example.com"} ${emailPad}`,
  },
});

try {
  const hookResult = measure(
    "hook-spawn-to-exit",
    () => {
      const r = spawnSync(process.execPath, [cliPath, "hook"], {
        input: hookStdin,
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: hookProject },
      });
      if (r.status !== 0) {
        throw new Error(`hook exited ${r.status}: ${r.stderr}`);
      }
    },
    50,
    15,
  );
  results.push(hookResult);
} finally {
  rmSync(hookProject, { recursive: true, force: true });
}

let failed = false;
for (const { name, p50 } of results) {
  const budget = baseline.benchmarks?.[name]?.p50Ms;
  const overBaseline = budget != null && p50 > budget * REGRESSION_TOLERANCE;
  const overAbsolute = name === "hook-spawn-to-exit" && p50 >= HOOK_ABSOLUTE_P50_MS;
  const overBudget = overBaseline || overAbsolute;
  if (overBudget) failed = true;
  const parts = [];
  if (budget != null) parts.push(`${budget}ms baseline`);
  if (name === "hook-spawn-to-exit") parts.push(`absolute < ${HOOK_ABSOLUTE_P50_MS}ms`);
  if (parts.length === 0) parts.push("no baseline");
  console.log(
    `[${overBudget ? "FAIL" : "ok"}] ${name}: p50=${p50.toFixed(4)}ms (${parts.join(", ")})`,
  );
}

if (failed) {
  console.error(
    `\nBenchmark failed absolute gate and/or regressed >${((REGRESSION_TOLERANCE - 1) * 100).toFixed(0)}% over baseline. ` +
      "If intentional, update benchmarks/baseline.json in this PR with justification.",
  );
  process.exit(1);
}

console.log("\nAll benchmarks within budget.");
