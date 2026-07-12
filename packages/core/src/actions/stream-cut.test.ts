/**
 * Unit tests for stream emit-cut (docs/vault.md §5).
 */

import { describe, expect, it } from "vitest";

import { computeStreamEmitEnd } from "./stream-cut";

describe("computeStreamEmitEnd", () => {
  it("holds the full buffer when shorter than holdback", () => {
    expect(computeStreamEmitEnd(50, [], 128, false)).toBe(0);
  });

  it("flushes everything when final", () => {
    expect(computeStreamEmitEnd(500, [{ start: 100, end: 120 }], 128, true)).toBe(500);
  });

  it("uses length - holdback when no span straddles", () => {
    expect(computeStreamEmitEnd(300, [{ start: 10, end: 20 }], 128, false)).toBe(172);
  });

  it("pulls cut back to the start of a straddling span", () => {
    // tentative cut = 300 - 128 = 172; span [170, 190) straddles
    expect(computeStreamEmitEnd(300, [{ start: 170, end: 190 }], 128, false)).toBe(170);
  });

  it("uses the earliest straddling span start", () => {
    expect(
      computeStreamEmitEnd(
        300,
        [
          { start: 160, end: 180 },
          { start: 165, end: 175 },
        ],
        128,
        false,
      ),
    ).toBe(160);
  });
});
