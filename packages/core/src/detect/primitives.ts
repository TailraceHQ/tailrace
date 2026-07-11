/**
 * Shared, dependency-free primitives for Tier 0 recognizers: entropy, charset checks,
 * and the validators that upgrade a pattern match to confidence 1.0 (docs/detection.md §2).
 *
 * Everything here is synchronous and edge-safe (no `node:` imports, no `Buffer`).
 */

/** Shannon entropy of `s` in bits per character (0 for the empty string). */
export function shannonEntropy(s: string): number {
  if (s.length === 0) return 0;
  const counts = new Map<string, number>();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * True when `s` spans a base62-or-richer alphabet: it contains a lowercase letter, an
 * uppercase letter, and a digit. Used to gate `high_entropy_secret` so lowercase-hex
 * hashes and all-caps identifiers don't qualify (docs/detection.md §2).
 */
export function hasBase62Charset(s: string): boolean {
  let lower = false;
  let upper = false;
  let digit = false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 97 && code <= 122) lower = true;
    else if (code >= 65 && code <= 90) upper = true;
    else if (code >= 48 && code <= 57) digit = true;
  }
  return lower && upper && digit;
}

/** Luhn checksum validation over a digits-only string. */
export function luhnValid(digits: string): boolean {
  if (digits.length === 0) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** IBAN mod-97 validation (ISO 13616). Input may contain spaces. */
export function ibanValid(iban: string): boolean {
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    // A-Z -> 10-35, 0-9 -> themselves.
    const chunk = code >= 65 ? (code - 55).toString() : String.fromCharCode(code);
    for (let j = 0; j < chunk.length; j++) {
      remainder = (remainder * 10 + (chunk.charCodeAt(j) - 48)) % 97;
    }
  }
  return remainder === 1;
}

/** Decode a base64url JWT segment to a parsed object, or null if it isn't valid JSON. */
export function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when a decoded JWT header looks real: a non-empty string `alg`, and if `typ` is present it is "JWT". */
export function isJwtHeader(header: Record<string, unknown>): boolean {
  const alg = header["alg"];
  if (typeof alg !== "string" || alg.length === 0) return false;
  const typ = header["typ"];
  if (typ !== undefined && typeof typ === "string" && typ.toUpperCase() !== "JWT") return false;
  return true;
}

/** Parse a dotted IPv4 string to its four octets, or null if any octet is out of range. */
export function parseIpv4(s: string): [number, number, number, number] | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    // Reject non-canonical leading zeros ("01") so we don't match version strings.
    if (part.length > 1 && part[0] === "0") return null;
    octets.push(n);
  }
  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

/** True for private, loopback, link-local, CGNAT, documentation, multicast, and reserved IPv4. */
export function isPrivateOrReservedIpv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 0) return true; // "this network"
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1 documentation
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/** True for IPv6 loopback, unspecified, link-local, unique-local, and documentation ranges. */
export function isPrivateOrReservedIpv6(address: string): boolean {
  const addr = address.toLowerCase();
  if (addr === "::1" || addr === "::") return true;
  if (
    addr.startsWith("fe8") ||
    addr.startsWith("fe9") ||
    addr.startsWith("fea") ||
    addr.startsWith("feb")
  )
    return true; // link-local fe80::/10
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique-local fc00::/7
  if (addr.startsWith("2001:db8")) return true; // documentation 2001:db8::/32
  if (addr.startsWith("ff")) return true; // multicast
  return false;
}
