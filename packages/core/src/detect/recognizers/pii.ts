/**
 * Tier 0 structured-PII recognizers (docs/detection.md §2, "Structured PII"). All synchronous.
 * Recognizers that carry a validator (Luhn, mod-97, area rules, IP-range) drop non-conforming
 * matches entirely rather than emitting a low-confidence span.
 */

import type { Recognizer, Span } from "../../types";
import {
  ibanValid,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  luhnValid,
  parseIpv4,
} from "../primitives";
import { scanPatterns, type Pattern } from "./shared";

const EMAIL_PATTERNS: readonly Pattern[] = [
  // TLD length >= 2 is enforced by the `{2,}` (docs/detection.md §2).
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, confidence: 1 },
];

export const emailRecognizer: Recognizer = {
  id: "email",
  entities: ["email"],
  tier: 0,
  scan: (text) => scanPatterns(text, EMAIL_PATTERNS, "email", "email"),
};

const PHONE_PATTERNS: readonly Pattern[] = [
  // E.164 / international with a `+` country prefix -> confidence 1.0.
  {
    re: /(?<![\w+])\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){1,4}(?![\w])/g,
    confidence: 1,
  },
  // Grouped national format with separators -> confidence 0.8. Requires separators so we
  // don't match bare digit runs like order numbers.
  {
    re: /(?<![\w+])\(?\d{2,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?(?![\w])/g,
    confidence: 0.8,
  },
];

/** Count decimal digits in a matched phone string. */
function digitCount(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) n++;
  }
  return n;
}

export const phoneRecognizer: Recognizer = {
  id: "phone",
  entities: ["phone"],
  tier: 0,
  scan: (text) => {
    const spans = scanPatterns(text, PHONE_PATTERNS, "phone", "phone");
    // Require 7..15 digits (docs/detection.md §2).
    return spans.filter((s) => {
      const digits = digitCount(text.slice(s.start, s.end));
      return digits >= 7 && digits <= 15;
    });
  },
};

const CREDIT_CARD_RE = /(?<![\d.])\d(?:[ -]?\d){12,18}(?![\d.])/g;

export const creditCardRecognizer: Recognizer = {
  id: "credit_card",
  entities: ["credit_card"],
  tier: 0,
  scan: (text) => {
    const spans: Span[] = [];
    CREDIT_CARD_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CREDIT_CARD_RE.exec(text)) !== null) {
      const digits = m[0].replace(/[^\d]/g, "");
      if (digits.length < 13 || digits.length > 19) continue;
      if (!luhnValid(digits)) continue; // non-Luhn -> drop the span entirely
      spans.push({
        entity: "credit_card",
        start: m.index,
        end: m.index + m[0].length,
        confidence: 1,
        recognizer: "credit_card",
      });
    }
    return spans;
  },
};

const IBAN_RE = /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}(?![A-Za-z0-9])/g;

export const ibanRecognizer: Recognizer = {
  id: "iban",
  entities: ["iban"],
  tier: 0,
  scan: (text) => {
    const spans: Span[] = [];
    IBAN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IBAN_RE.exec(text)) !== null) {
      const raw = m[0].trimEnd();
      if (!ibanValid(raw)) continue;
      spans.push({
        entity: "iban",
        start: m.index,
        end: m.index + raw.length,
        confidence: 1,
        recognizer: "iban",
      });
    }
    return spans;
  },
};

const SSN_FORMATTED_RE = /(?<!\d)(\d{3})-(\d{2})-(\d{4})(?!\d)/g;
const SSN_UNFORMATTED_RE = /(?<!\d)(\d{3})(\d{2})(\d{4})(?!\d)/g;
const SSN_CONTEXT_RE = /ssn|social/gi;
const SSN_CONTEXT_WINDOW = 30;

/** Area/group/serial rules for a valid SSN (docs/detection.md §2). */
function ssnPartsValid(area: string, group: string, serial: string): boolean {
  const a = Number(area);
  if (a === 0 || a === 666 || a >= 900) return false;
  if (Number(group) === 0) return false;
  if (Number(serial) === 0) return false;
  return true;
}

export const ssnRecognizer: Recognizer = {
  id: "ssn",
  entities: ["ssn"],
  tier: 0,
  scan: (text) => {
    const spans: Span[] = [];

    SSN_FORMATTED_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SSN_FORMATTED_RE.exec(text)) !== null) {
      if (!ssnPartsValid(m[1]!, m[2]!, m[3]!)) continue;
      spans.push({
        entity: "ssn",
        start: m.index,
        end: m.index + m[0].length,
        confidence: 1,
        recognizer: "ssn",
      });
    }

    // Unformatted 9-digit runs only count near an "ssn"/"social" keyword.
    const contextEnds: number[] = [];
    SSN_CONTEXT_RE.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = SSN_CONTEXT_RE.exec(text)) !== null) contextEnds.push(c.index + c[0].length);
    if (contextEnds.length > 0) {
      SSN_UNFORMATTED_RE.lastIndex = 0;
      while ((m = SSN_UNFORMATTED_RE.exec(text)) !== null) {
        if (!ssnPartsValid(m[1]!, m[2]!, m[3]!)) continue;
        const start = m.index;
        const near = contextEnds.some((end) => start >= end && start - end <= SSN_CONTEXT_WINDOW);
        if (!near) continue;
        spans.push({
          entity: "ssn",
          start,
          end: start + m[0].length,
          confidence: 0.8,
          recognizer: "ssn",
        });
      }
    }
    return spans;
  },
};

const IPV4_RE = /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/g;
// Comprehensive IPv6 matcher (all compression forms + IPv4-mapped tail).
const IPV6_RE =
  /(?<![:.\w])(?:(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|[A-Fa-f0-9]{1,4}:(?::[A-Fa-f0-9]{1,4}){1,6}|:(?:(?::[A-Fa-f0-9]{1,4}){1,7}|:)|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9])\.){3}(?:25[0-5]|(?:2[0-4]|1?[0-9])?[0-9]))(?![:.\w])/g;

export function ipAddressRecognizer(includePrivateIps = false): Recognizer {
  return {
    id: "ip_address",
    entities: ["ip_address"],
    tier: 0,
    scan: (text) => {
      const spans: Span[] = [];

      IPV4_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = IPV4_RE.exec(text)) !== null) {
        const octets = parseIpv4(m[0]);
        if (octets === null) continue;
        if (!includePrivateIps && isPrivateOrReservedIpv4(octets)) continue;
        spans.push({
          entity: "ip_address",
          start: m.index,
          end: m.index + m[0].length,
          confidence: 1,
          recognizer: "ip_address",
        });
      }

      IPV6_RE.lastIndex = 0;
      while ((m = IPV6_RE.exec(text)) !== null) {
        if (!includePrivateIps && isPrivateOrReservedIpv6(m[0])) continue;
        spans.push({
          entity: "ip_address",
          start: m.index,
          end: m.index + m[0].length,
          confidence: 1,
          recognizer: "ip_address",
        });
      }
      return spans;
    },
  };
}

const URL_CREDENTIALS_PATTERNS: readonly Pattern[] = [
  { re: /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s"'<>]+/g, confidence: 1 },
];

export const urlCredentialsRecognizer: Recognizer = {
  id: "url_credentials",
  entities: ["url_credentials"],
  tier: 0,
  scan: (text) =>
    scanPatterns(text, URL_CREDENTIALS_PATTERNS, "url_credentials", "url_credentials"),
};

/** Tier 0 PII recognizers that need no configuration. */
export const STATIC_PII_RECOGNIZERS: readonly Recognizer[] = [
  emailRecognizer,
  phoneRecognizer,
  creditCardRecognizer,
  ibanRecognizer,
  ssnRecognizer,
  urlCredentialsRecognizer,
];
