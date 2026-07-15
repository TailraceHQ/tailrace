import { describe, expect, it } from "vitest";

import { definePatternRecognizer, type Span } from "@tailrace/core";
import { compileRecognizersFromConfig, isCompiledPatternRecognizer } from "./recognizers";

describe("compileRecognizersFromConfig", () => {
  it("compiles valid JSON entries", () => {
    const [recognizer] = compileRecognizersFromConfig([
      {
        id: "employee-id",
        entity: "employee_id",
        tier: 0,
        patterns: [{ source: String.raw`\bEMP-\d{5}\b`, confidence: 1 }],
      },
    ]);
    const spans = recognizer!.scan("EMP-01234") as Span[];
    expect(spans.some((s) => s.entity === "employee_id")).toBe(true);
  });

  it("rejects evil patterns with index in message", () => {
    expect(() =>
      compileRecognizersFromConfig([
        {
          id: "evil",
          entity: "employee_id",
          tier: 0,
          patterns: [{ source: "(a+)+" }],
        },
      ]),
    ).toThrow(/recognizers\[0\]/);
  });

  it("validates compiled pattern shape", () => {
    expect(
      isCompiledPatternRecognizer({
        id: "x",
        entity: "employee_id",
        tier: 0,
        patterns: [{ source: "EMP" }],
      }),
    ).toBe(true);
    expect(isCompiledPatternRecognizer({ id: "x", entity: "y", tier: 1, patterns: [] })).toBe(
      false,
    );
  });
});

describe("definePatternRecognizer from CLI path", () => {
  it("matches engine helper used by hook config loader", () => {
    const r = definePatternRecognizer({
      id: "employee-id",
      entity: "employee_id",
      tier: 0,
      patterns: [{ source: "EMP-\\d{5}" }],
    });
    expect(r.id).toBe("employee-id");
  });
});
