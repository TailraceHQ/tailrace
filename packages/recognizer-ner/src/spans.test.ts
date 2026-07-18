import { describe, expect, it } from "vitest";

import { buildLabelInfo } from "./label-info";
import { PRIVACY_FILTER_ID2LABEL } from "./labels";
import { labelsToSpans, tokenSpansToCharSpans, trimCharSpansWhitespace } from "./spans";

describe("labelsToSpans", () => {
  const labelInfo = buildLabelInfo(PRIVACY_FILTER_ID2LABEL);

  it("builds a span from B-I-E labels", () => {
    // O, B-secret, I-secret, E-secret, O
    const labels = new Map<number, number>([
      [0, 0],
      [1, 29],
      [2, 30],
      [3, 31],
      [4, 0],
    ]);
    const spans = labelsToSpans(labels, labelInfo);
    // secret is span class index 8 (O + 8 categories in order…)
    // spanClassNames: O, account_number, private_address, private_date, private_email,
    // private_person, private_phone, private_url, secret → secret = 8
    expect(spans).toEqual([[8, 1, 4]]);
  });

  it("maps token spans to char offsets and trims whitespace", () => {
    const text = "  Alice  ";
    const charStarts = [0, 2, 7];
    const charEnds = [2, 7, 9];
    // person span on token 1 only (chars 2..7 = "Alice")
    const charSpans = tokenSpansToCharSpans([[5, 1, 2]], charStarts, charEnds);
    expect(charSpans).toEqual([[5, 2, 7]]);
    expect(trimCharSpansWhitespace([[5, 0, 9]], text)).toEqual([[5, 2, 7]]);
  });
});
