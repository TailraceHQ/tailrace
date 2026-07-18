/**
 * Tier 0 performance gate (docs/detection.md §6, docs/conventions.md §Performance CI):
 * a full-recognizer scan of a 4KB mixed input must hit p50 < 5ms.
 *
 * This is the in-suite smoke gate and asserts p50 only. The p99 < 15ms tail-latency
 * gate lives in the isolated benchmark harness (benchmarks/harness.mjs, per
 * docs/detection.md §6): wall-clock tail latency is only meaningful when measured
 * without CPU contention, whereas Vitest runs this file in a parallel worker pool
 * alongside the rest of the suite, where a p99 assertion measures scheduler jitter
 * rather than detection speed. Node-only (wall-clock timing).
 */

import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { createDetectionEngine } from "../src/detect";
import { definePatternRecognizer } from "../src/detect/pattern-recognizer";

/** ~4KB of prose with secrets/PII sprinkled throughout. */
function build4kbInput(): string {
  // Built by concatenation so the assembled key never exists as a literal in the repo.
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
  return input.slice(0, 4096);
}

describe("Tier 0 perf gate", () => {
  it("scans a 4KB mixed input at p50 < 5ms", async () => {
    const engine = createDetectionEngine();
    const input = build4kbInput();

    // Sanity: the fixture actually contains detectable entities.
    expect((await engine.detect(input)).length).toBeGreaterThan(0);

    for (let i = 0; i < 100; i++) await engine.detect(input); // warmup

    // measured p50 is ~0.5ms, far under budget, so this is stable under the parallel pool.
    const iterations = 2000;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      await engine.detect(input);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(iterations * 0.5)]!;

    expect(p50, `p50=${p50.toFixed(3)}ms`).toBeLessThan(5);
  });

  it("with three typical custom patterns still meets p50 < 5ms on 4KB", async () => {
    const custom = [
      definePatternRecognizer({
        id: "employee-id",
        entity: "employee_id",
        tier: 0,
        patterns: [{ source: String.raw`\bEMP-\d{5}\b` }],
      }),
      definePatternRecognizer({
        id: "ticket-id",
        entity: "ticket_id",
        tier: 0,
        patterns: [{ source: String.raw`\bTKT-\d{6}\b` }],
      }),
      definePatternRecognizer({
        id: "project-code",
        entity: "project_code",
        tier: 0,
        patterns: [{ source: String.raw`\bPRJ-[A-Z]{3}\b` }],
      }),
    ];
    const engine = createDetectionEngine({ recognizers: custom });
    const input = build4kbInput() + " EMP-01234 TKT-123456 PRJ-ABC";

    for (let i = 0; i < 100; i++) await engine.detect(input);

    const iterations = 2000;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      await engine.detect(input);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(iterations * 0.5)]!;
    expect(p50, `p50=${p50.toFixed(3)}ms`).toBeLessThan(5);
  });
});
