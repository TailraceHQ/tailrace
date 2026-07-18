// Perf-gate harness (docs/conventions.md §Performance CI).
//
// Gates: Tier 0 detection engine scan, plus hook spawn-to-exit p50 < 150ms (M4).
// Regressions > 20% over baseline.json fail CI.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { createDetectionEngine } from "../packages/core/dist/detect/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const baseline = JSON.parse(readFileSync(join(here, "baseline.json"), "utf8"));

// docs/conventions.md: regressions > 20% over baseline fail CI.
const REGRESSION_TOLERANCE = 1.2;
/** Absolute gate from milestones.md §M4 (spawn-to-exit p50). */
const HOOK_ABSOLUTE_P50_MS = 150;
/** Absolute Tier 0 tail-latency gate from docs/detection.md §6 (4KB scan p99). */
const TIER0_ABSOLUTE_P99_MS = 15;

/**
 * Measure the p50 and p99 latency (ms) of sync `fn` over `iterations` samples, after a warmup.
 * This harness runs isolated (no parallel worker pool), so the p99 tail is meaningful here -
 * unlike the in-suite Vitest smoke gate, which asserts p50 only (packages/core/tests/perf.test.ts).
 */
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
  const p99 = samples[Math.floor(samples.length * 0.99)];
  return { name, p50, p99 };
}

/** Async variant for `detect()` (returns Promise after M8 async engine wiring). */
async function measureAsync(name, fn, iterations = 2000, warmup = 200) {
  for (let i = 0; i < warmup; i++) await fn();
  const samples = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples[i] = performance.now() - t0;
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)];
  const p99 = samples[Math.floor(samples.length * 0.99)];
  return { name, p50, p99 };
}

// ~4KB mixed input aligned with packages/core/tests/perf.test.ts
const leakedKey = "sk_live_" + "C6Qc2MmKqcgowaGAyOQKG420";
const block = [
  "The support agent reviewed the ticket and contacted alice@example.com about the outage.",
  `A misconfigured job had logged ${leakedKey} into the shared channel.`,
  "Please call +1 415 555 0132 or the on-call line, and rotate the token immediately.",
  "Card 4532 0151 1283 0366 was used for the test charge; the server is at 8.8.8.8.",
  "connection: postgres://dbuser:s3cr3tFAKE@db.example.com:5432/appdb should be revoked.",
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.",
].join(" ");
let input = "";
while (input.length < 4096) input += block + " ";
input = input.slice(0, 4096);

const engine = createDetectionEngine();

const results = [await measureAsync("tier0-4kb-scan", () => engine.detect(input))];

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
for (const { name, p50, p99 } of results) {
  const budget = baseline.benchmarks?.[name]?.p50Ms;
  const overBaseline = budget != null && p50 > budget * REGRESSION_TOLERANCE;
  const overHookAbsolute = name === "hook-spawn-to-exit" && p50 >= HOOK_ABSOLUTE_P50_MS;
  const overTier0P99 = name === "tier0-4kb-scan" && p99 >= TIER0_ABSOLUTE_P99_MS;
  const overBudget = overBaseline || overHookAbsolute || overTier0P99;
  if (overBudget) failed = true;
  const parts = [];
  if (budget != null) parts.push(`${budget}ms p50 baseline`);
  if (name === "hook-spawn-to-exit") parts.push(`absolute p50 < ${HOOK_ABSOLUTE_P50_MS}ms`);
  if (name === "tier0-4kb-scan") parts.push(`absolute p99 < ${TIER0_ABSOLUTE_P99_MS}ms`);
  if (parts.length === 0) parts.push("no baseline");
  console.log(
    `[${overBudget ? "FAIL" : "ok"}] ${name}: p50=${p50.toFixed(4)}ms p99=${p99.toFixed(4)}ms (${parts.join(", ")})`,
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
