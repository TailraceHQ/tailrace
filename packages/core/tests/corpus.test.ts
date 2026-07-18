/**
 * Data-driven precision/recall gates over the fixture corpus (docs/detection.md §6).
 * Node-only (reads fixtures from disk). For each Tier 0 entity:
 *  - recall    >= 0.95 : every positive line yields at least one span of that entity.
 *  - precision >= 0.95 : at most 5% of hard-negative lines yield a span of that entity.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createDetectionEngine } from "../src/detect";
import type { EntityClass } from "../src/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const engine = createDetectionEngine();

function fixtureLines(kind: "positives" | "negatives", entity: string): string[] {
  return readFileSync(join(fixturesDir, kind, `${entity}.txt`), "utf8")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

const ENTITIES: EntityClass[] = [
  "api_key",
  "jwt",
  "private_key",
  "high_entropy_secret",
  "connection_string",
  "email",
  "phone",
  "credit_card",
  "iban",
  "ssn",
  "ip_address",
  "url_credentials",
];

describe("Tier 0 corpus", () => {
  for (const entity of ENTITIES) {
    it(`${entity}: recall >= 0.95`, async () => {
      const positives = fixtureLines("positives", entity);
      expect(positives.length).toBeGreaterThanOrEqual(10);
      const misses: string[] = [];
      for (const line of positives) {
        const spans = await engine.detect(line);
        if (!spans.some((s) => s.entity === entity)) misses.push(line);
      }
      const recall = (positives.length - misses.length) / positives.length;
      expect(recall, `${entity} missed: ${JSON.stringify(misses)}`).toBeGreaterThanOrEqual(0.95);
    });

    it(`${entity}: precision >= 0.95`, async () => {
      const negatives = fixtureLines("negatives", entity);
      expect(negatives.length).toBeGreaterThanOrEqual(10);
      const falsePositives: string[] = [];
      for (const line of negatives) {
        const spans = await engine.detect(line);
        if (spans.some((s) => s.entity === entity)) falsePositives.push(line);
      }
      const precision = (negatives.length - falsePositives.length) / negatives.length;
      expect(
        precision,
        `${entity} false positives: ${JSON.stringify(falsePositives)}`,
      ).toBeGreaterThanOrEqual(0.95);
    });
  }
});
