import { describe, expect, it } from "vitest";

import { mergeSpans } from "./merge";
import type { Span } from "../types";

function span(entity: string, start: number, end: number, confidence: number): Span {
  return { entity, start, end, confidence, recognizer: "test" };
}

describe("mergeSpans", () => {
  it("drops spans below the confidence threshold", () => {
    const out = mergeSpans([span("email", 0, 5, 0.5)], { defaultThreshold: 0.6 });
    expect(out).toHaveLength(0);
  });

  it("honors per-entity thresholds", () => {
    const spans = [span("phone", 0, 5, 0.7), span("email", 6, 11, 0.7)];
    const out = mergeSpans(spans, { thresholds: { phone: 0.9 }, defaultThreshold: 0.6 });
    expect(out.map((s) => s.entity)).toEqual(["email"]);
  });

  it("unions overlapping spans of the same entity and keeps the higher confidence", () => {
    const out = mergeSpans([span("email", 0, 5, 0.8), span("email", 3, 9, 1)]);
    expect(out).toEqual([
      expect.objectContaining({ entity: "email", start: 0, end: 9, confidence: 1 }),
    ]);
  });

  it("keeps overlapping spans of different entities", () => {
    const out = mergeSpans([span("email", 0, 6, 1), span("url_credentials", 2, 8, 1)]);
    expect(out).toHaveLength(2);
  });

  it("returns spans sorted ascending by start", () => {
    const out = mergeSpans([span("email", 20, 25, 1), span("phone", 0, 5, 1)]);
    expect(out.map((s) => s.start)).toEqual([0, 20]);
  });

  it("does not union adjacent (touching) spans", () => {
    const out = mergeSpans([span("email", 0, 5, 1), span("email", 5, 10, 1)]);
    expect(out).toHaveLength(2);
  });
});
