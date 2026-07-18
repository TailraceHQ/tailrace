import { describe, expect, it } from "vitest";

import { offsetsForTokens, tokenizeO200k } from "./tokenize";

describe("offsetsForTokens", () => {
  it("maps ASCII tokens one-to-one", () => {
    const text = "hello world";
    const tokenPieces = ["hello", " world"];
    const { charStarts, charEnds } = offsetsForTokens(text, [0, 1], (ids) =>
      tokenPieces.slice(0, ids.length).join(""),
    );
    expect(charStarts).toEqual([0, 5]);
    expect(charEnds).toEqual([5, 11]);
  });

  it("recovers a multi-byte character split across token boundaries", () => {
    // Simulates a BPE tokenizer where decoding token 1 alone is an incomplete UTF-8
    // sequence (U+FFFD) that only resolves once token 2's bytes are included.
    const text = "hi \u{1F389} bye"; // "hi 🎉 bye"
    const prefixDecodes = ["hi ", "hi �", `hi ${"\u{1F389}"}`, `hi ${"\u{1F389}"} bye`];
    const { charStarts, charEnds } = offsetsForTokens(text, [0, 1, 2, 3], (ids) => {
      const decoded = prefixDecodes[ids.length - 1];
      if (decoded === undefined) throw new Error("unexpected prefix length");
      return decoded;
    });
    // Tokens 1 and 2 jointly resolve to the emoji and share its span.
    expect(charStarts).toEqual([0, 3, 3, 5]);
    expect(charEnds).toEqual([3, 5, 5, 9]);
  });
});

describe("tokenizeO200k", () => {
  it("covers the full string with no gaps for emoji-heavy text", async () => {
    const text = "\u{1F600}\u{1F389} Contact us at test@example.com \u{1F680} done \u{1F4AF}";
    const { inputIds, charStarts, charEnds } = await tokenizeO200k(text);
    expect(inputIds.length).toBeGreaterThan(0);
    expect(charStarts[0]).toBe(0);
    expect(charEnds[charEnds.length - 1]).toBe(text.length);
    for (let i = 0; i < inputIds.length; i++) {
      expect(charStarts[i]).toBeGreaterThanOrEqual(0);
      expect(charEnds[i]!).toBeGreaterThanOrEqual(charStarts[i]!);
      if (i > 0) expect(charStarts[i]!).toBeGreaterThanOrEqual(charStarts[i - 1]!);
    }
  });

  it("covers plain ASCII text with contiguous offsets", async () => {
    const text = "Contact test@example.com or call 555-123-4567";
    const { inputIds, charStarts, charEnds } = await tokenizeO200k(text);
    expect(charStarts[0]).toBe(0);
    expect(charEnds[charEnds.length - 1]).toBe(text.length);
    expect(inputIds.length).toBe(charStarts.length);
  });
});
