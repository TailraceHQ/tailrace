/**
 * Tier 0 performance gate (docs/detection.md §6, docs/conventions.md §Performance CI):
 * a full-recognizer scan of a 4KB mixed input must hit p50 < 5ms and p99 < 15ms.
 * Node-only (wall-clock timing). Generous headroom keeps this non-flaky on CI runners.
 */

import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { createDetectionEngine } from "../src/detect";

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
  it("scans a 4KB mixed input at p50 < 5ms and p99 < 15ms", () => {
    const engine = createDetectionEngine();
    const input = build4kbInput();

    // Sanity: the fixture actually contains detectable entities.
    expect(engine.detect(input).length).toBeGreaterThan(0);

    for (let i = 0; i < 100; i++) engine.detect(input); // warmup

    // Enough samples that the p99 index (~1980th of 2000) is robust to occasional GC pauses;
    // measured p50/p99 are ~0.5ms/~1ms, far under budget, so this is stable in CI.
    const iterations = 2000;
    const samples: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      engine.detect(input);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(iterations * 0.5)]!;
    const p99 = samples[Math.floor(iterations * 0.99)]!;

    expect(p50, `p50=${p50.toFixed(3)}ms`).toBeLessThan(5);
    expect(p99, `p99=${p99.toFixed(3)}ms`).toBeLessThan(15);
  });
});
