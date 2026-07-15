import { describe, expect, it, vi } from "vitest";

import { RecognizerError } from "../errors";
import { definePatternRecognizer } from "./pattern-recognizer";
import type { Span } from "../types";
import { scanPatterns } from "./recognizers/shared";

describe("definePatternRecognizer", () => {
  it("detects employee ids with default confidence", () => {
    const recognizer = definePatternRecognizer({
      id: "employee-id",
      entity: "employee_id",
      tier: 0,
      patterns: [{ source: String.raw`\bEMP-\d{5}\b` }],
    });
    const spans = recognizer.scan("Assign EMP-01234 to Alice");
    expect(spans).toEqual([
      expect.objectContaining({
        entity: "employee_id",
        start: 7,
        end: 16,
        confidence: 0.8,
        recognizer: "employee-id",
      }),
    ]);
  });

  it("rejects reserved built-in entity names", () => {
    expect(() =>
      definePatternRecognizer({
        id: "bad",
        entity: "email",
        tier: 0,
        patterns: [{ source: "@" }],
      }),
    ).toThrow(RecognizerError);
  });

  it("rejects invalid entity name shape", () => {
    expect(() =>
      definePatternRecognizer({
        id: "bad",
        entity: "EmployeeId",
        tier: 0,
        patterns: [{ source: "x" }],
      }),
    ).toThrow(RecognizerError);
  });

  it("rejects evil patterns at registration", () => {
    expect(() =>
      definePatternRecognizer({
        id: "evil",
        entity: "employee_id",
        tier: 0,
        patterns: [{ source: "(a+)+" }],
      }),
    ).toThrow(RecognizerError);
  });

  it("uses gu flags and handles zero-length matches safely", () => {
    const recognizer = definePatternRecognizer({
      id: "zero",
      entity: "marker",
      tier: 0,
      patterns: [{ source: "(?:a|$)", confidence: 1 }],
    });
    const result = recognizer.scan("bbb");
    expect(result).not.toBeInstanceOf(Promise);
    expect((result as Span[]).length).toBeLessThanOrEqual(4);
  });
});

describe("scanPatterns limits", () => {
  it("stops at max matches and invokes budget callback", () => {
    const onBudgetExceeded = vi.fn();
    const re = /a/g;
    const spans = scanPatterns("aaaaaaaaaa", [{ re, confidence: 1 }], "marker", "test", {
      maxMatchesPerPattern: 3,
      onBudgetExceeded,
    });
    expect(spans).toHaveLength(3);
    expect(onBudgetExceeded).toHaveBeenCalledOnce();
  });
});
