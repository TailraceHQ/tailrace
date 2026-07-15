import { describe, expect, it } from "vitest";

import { RecognizerError } from "../errors";
import { MAX_PATTERN_SOURCE_LENGTH, validatePatternSource } from "./regex-safety";

describe("validatePatternSource", () => {
  it("accepts safe employee-id style patterns", () => {
    expect(() => validatePatternSource(String.raw`\bEMP-\d{5}\b`, 0)).not.toThrow();
    expect(() => validatePatternSource(String.raw`^[A-Z]{2}-\d{4}$`, 0)).not.toThrow();
    expect(() => validatePatternSource("(?:foo|bar)", 0)).not.toThrow();
  });

  it("rejects overlong sources", () => {
    const long = "a".repeat(MAX_PATTERN_SOURCE_LENGTH + 1);
    expect(() => validatePatternSource(long, 2)).toThrow(RecognizerError);
    try {
      validatePatternSource(long, 2);
    } catch (err) {
      expect((err as Error).message).toContain("pattern 2");
      expect((err as Error).message).not.toContain(long);
    }
  });

  it("rejects backreferences", () => {
    expect(() => validatePatternSource("(a)\\1", 0)).toThrow(RecognizerError);
    expect(() => validatePatternSource("\\k<name>", 0)).toThrow(RecognizerError);
  });

  it("rejects nested quantifiers on groups", () => {
    expect(() => validatePatternSource("(a+)+", 0)).toThrow(RecognizerError);
    expect(() => validatePatternSource("(a*)*", 0)).toThrow(RecognizerError);
    expect(() => validatePatternSource("(a+)*", 0)).toThrow(RecognizerError);
  });

  it("rejects large or unbounded brace quantifiers on repeated groups", () => {
    expect(() => validatePatternSource("(a){0,200}", 0)).toThrow(RecognizerError);
    expect(() => validatePatternSource("(a+){1,}", 0)).toThrow(RecognizerError);
  });

  it("rejects quantified lookbehind", () => {
    expect(() => validatePatternSource("(?<=a+)", 0)).toThrow(RecognizerError);
    expect(() => validatePatternSource("(?<!x*)", 0)).toThrow(RecognizerError);
  });
});
