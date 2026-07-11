import { describe, expect, it } from "vitest";

import { scanObject } from "./object-scan";
import type { JsonObject, Span } from "../types";

/** Flags every occurrence of "SECRET" in a leaf. */
function markSecret(text: string): Span[] {
  const spans: Span[] = [];
  let i = text.indexOf("SECRET");
  while (i !== -1) {
    spans.push({ entity: "api_key", start: i, end: i + 6, confidence: 1, recognizer: "t" });
    i = text.indexOf("SECRET", i + 1);
  }
  return spans;
}

describe("scanObject", () => {
  it("walks nested strings, arrays, and attaches RFC 6901 paths", () => {
    const input: JsonObject = {
      a: "SECRET",
      b: { c: "xSECRET" },
      arr: ["ok", "SECRET"],
      n: 42,
      bool: true,
    };
    const spans = scanObject(input, markSecret);
    expect(spans.map((s) => s.path).sort()).toEqual(["/a", "/arr/1", "/b/c"]);
  });

  it("scans object keys too (a secret can be a key)", () => {
    const spans = scanObject({ SECRET: "value" }, markSecret);
    expect(spans.map((s) => s.path)).toContain("/SECRET");
  });

  it("escapes ~ and / in property names per RFC 6901", () => {
    const spans = scanObject({ "a/b": "SECRET", "c~d": "SECRET" }, markSecret);
    expect(spans.map((s) => s.path).sort()).toEqual(["/a~1b", "/c~0d"]);
  });

  it("is cycle-safe", () => {
    const input: JsonObject = { a: "SECRET" };
    (input as Record<string, unknown>)["self"] = input;
    expect(() => scanObject(input, markSecret)).not.toThrow();
    expect(scanObject(input, markSecret)).toHaveLength(1);
  });

  it("stops at the depth limit", () => {
    let deep: JsonObject = { leaf: "SECRET" };
    for (let i = 0; i < 40; i++) deep = { nested: deep };
    expect(scanObject(deep, markSecret, 32)).toHaveLength(0);
  });
});
