import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { definePatternRecognizer } from "./pattern-recognizer";
import type { Span } from "../types";

/** Safe literal patterns for fuzzing - no nested quantifiers. */
const safePatternArb = fc
  .array(fc.constantFrom("a", "b", "c", "0", "1", "-", "_"), { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(""));

const asciiInputArb = fc.string({ minLength: 0, maxLength: 256 });

describe("definePatternRecognizer property tests", () => {
  it("scan completes without throw for safe literal patterns", () => {
    fc.assert(
      fc.property(safePatternArb, asciiInputArb, (literal, text) => {
        const recognizer = definePatternRecognizer({
          id: "fuzz",
          entity: "fuzz_entity",
          tier: 0,
          patterns: [{ source: literal }],
        });
        expect(() => recognizer.scan(text)).not.toThrow();
        const result = recognizer.scan(text);
        expect(result).not.toBeInstanceOf(Promise);
        const spans = result as Span[];
        for (const span of spans) {
          expect(span.end).toBeGreaterThanOrEqual(span.start);
          expect(span.end).toBeLessThanOrEqual(text.length);
        }
      }),
      { numRuns: 80 },
    );
  });
});
