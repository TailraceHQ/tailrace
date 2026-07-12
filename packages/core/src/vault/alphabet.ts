/**
 * Token-id alphabet shared by generation and restore scanning.
 *
 * BUG RISK (vault.md §1 vs §4): §1 says "base32" (RFC 4648 → [A-Z2-7]) but §4 scans
 * `<LABEL_[a-z0-9]{8}>` and the worked example `<EMAIL_a3f2k9qx>` contains a `9`.
 * RFC 4648 tokens would NEVER match the restore regex. We pin a custom lowercase
 * alphanumeric alphabet and build both the encoder and the scan regexes from it.
 */

/** Custom token-id alphabet: lowercase a-z + digits 0-9 (matches vault.md §4 / example). */
export const TOKEN_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Fixed token-id length (vault.md §1 `[0..8]` → 8 chars). */
export const TOKEN_ID_LENGTH = 8;

/**
 * Character class used in restore regexes. MUST describe exactly {@link TOKEN_ID_ALPHABET}.
 * Kept as a string literal so RegExp sources stay readable; asserted at module load.
 */
export const TOKEN_ID_CHAR_CLASS = "[a-z0-9]";

function assertAlphabetMatchesCharClass(): void {
  if (TOKEN_ID_ALPHABET.length !== 36) {
    throw new Error("TOKEN_ID_ALPHABET must have 36 characters (a-z0-9)");
  }
  const re = new RegExp(`^${TOKEN_ID_CHAR_CLASS}$`);
  for (const ch of TOKEN_ID_ALPHABET) {
    if (!re.test(ch)) {
      throw new Error(
        `TOKEN_ID_ALPHABET char "${ch}" is not matched by TOKEN_ID_CHAR_CLASS ${TOKEN_ID_CHAR_CLASS}`,
      );
    }
  }
  // Every char-class match must be in the alphabet (spot-check digits + letters).
  for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
    if (!TOKEN_ID_ALPHABET.includes(ch)) {
      throw new Error(`TOKEN_ID_ALPHABET missing char-class member "${ch}"`);
    }
  }
}

assertAlphabetMatchesCharClass();

/**
 * Encode HMAC bytes as an 8-char token id using {@link TOKEN_ID_ALPHABET} (base-36).
 * Not RFC 4648 base32 - see module doc.
 */
export function bytesToTokenId(bytes: Uint8Array): string {
  // Interpret the first 8 bytes as a big-endian unsigned integer, then emit base-36 digits.
  let n = 0n;
  const take = Math.min(bytes.length, 8);
  for (let i = 0; i < take; i++) {
    n = (n << 8n) | BigInt(bytes[i]!);
  }
  const base = BigInt(TOKEN_ID_ALPHABET.length);
  let out = "";
  for (let i = 0; i < TOKEN_ID_LENGTH; i++) {
    out = TOKEN_ID_ALPHABET[Number(n % base)]! + out;
    n = n / base;
  }
  return out;
}

/** Entities that support `format: "preserve"` (vault.md §3). */
export const FORMAT_PRESERVE_ENTITIES: ReadonlySet<string> = new Set([
  "email",
  "phone",
  "credit_card",
]);
