import { describe, expect, it } from "vitest";

import {
  decodeBase64UrlJson,
  hasBase62Charset,
  ibanValid,
  isJwtHeader,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  luhnValid,
  parseIpv4,
  shannonEntropy,
} from "./primitives";

describe("shannonEntropy", () => {
  it("is 0 for empty and single-char-repeated strings", () => {
    expect(shannonEntropy("")).toBe(0);
    expect(shannonEntropy("aaaaaa")).toBe(0);
  });
  it("is log2(n) for n equiprobable symbols", () => {
    expect(shannonEntropy("abcd")).toBeCloseTo(2, 10);
  });
});

describe("hasBase62Charset", () => {
  it("requires lower, upper, and digit", () => {
    expect(hasBase62Charset("K4co8JmxGb")).toBe(true);
    expect(hasBase62Charset("abcdef0123")).toBe(false); // no upper
    expect(hasBase62Charset("ABCDEF0123")).toBe(false); // no lower
    expect(hasBase62Charset("abcdefABCDE")).toBe(false); // no digit
  });
});

describe("luhnValid", () => {
  it("accepts a valid PAN and rejects a tampered one", () => {
    expect(luhnValid("4242424242424242")).toBe(true);
    expect(luhnValid("4242424242424243")).toBe(false);
    expect(luhnValid("1111111111111111")).toBe(false);
  });
});

describe("ibanValid", () => {
  it("accepts a mod-97-valid IBAN (with or without spaces)", () => {
    expect(ibanValid("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanValid("GB82WEST12345698765432")).toBe(true);
  });
  it("rejects bad check digits and malformed input", () => {
    expect(ibanValid("GB00 WEST 1234 5698 7654 32")).toBe(false);
    expect(ibanValid("not an iban")).toBe(false);
  });
});

describe("JWT header decode", () => {
  it("decodes a base64url header and validates alg/typ", () => {
    // {"alg":"HS256","typ":"JWT"}
    const header = decodeBase64UrlJson("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(header).not.toBeNull();
    expect(isJwtHeader(header!)).toBe(true);
  });
  it("returns null for non-JSON and rejects headers without a string alg", () => {
    expect(decodeBase64UrlJson("not-base64url!!")).toBeNull();
    expect(isJwtHeader({ typ: "JWT" })).toBe(false);
  });
});

describe("IPv4 parsing and classification", () => {
  it("parses valid octets and rejects out-of-range / leading-zero forms", () => {
    expect(parseIpv4("8.8.8.8")).toEqual([8, 8, 8, 8]);
    expect(parseIpv4("256.0.0.1")).toBeNull();
    expect(parseIpv4("192.168.01.1")).toBeNull();
  });
  it("classifies private/reserved ranges", () => {
    expect(isPrivateOrReservedIpv4([10, 0, 0, 1])).toBe(true);
    expect(isPrivateOrReservedIpv4([192, 168, 1, 1])).toBe(true);
    expect(isPrivateOrReservedIpv4([172, 16, 5, 4])).toBe(true);
    expect(isPrivateOrReservedIpv4([127, 0, 0, 1])).toBe(true);
    expect(isPrivateOrReservedIpv4([8, 8, 8, 8])).toBe(false);
  });
  it("classifies reserved IPv6", () => {
    expect(isPrivateOrReservedIpv6("::1")).toBe(true);
    expect(isPrivateOrReservedIpv6("fe80::1")).toBe(true);
    expect(isPrivateOrReservedIpv6("fd00::1")).toBe(true);
    expect(isPrivateOrReservedIpv6("2606:4700:4700::1111")).toBe(false);
  });
});
