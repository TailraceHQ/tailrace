/**
 * Token derivation and format-preserving shapes (docs/vault.md §1, §3).
 */

import { getConsole } from "../console";
import type { EntityClass } from "../types";
import {
  bytesToTokenId,
  FORMAT_PRESERVE_ENTITIES,
  TOKEN_ID_CHAR_CLASS,
  TOKEN_ID_LENGTH,
} from "./alphabet";
import { hmacSha256 } from "./crypto";

const textEncoder = new TextEncoder();

/**
 * Label token scan: `<EMAIL_a3f2k9qx>`.
 * Token-id group is built from {@link TOKEN_ID_CHAR_CLASS} so it cannot drift from encoding.
 */
export const LABEL_RE = new RegExp(
  `<([A-Z][A-Z0-9_]*)_(${TOKEN_ID_CHAR_CLASS}{${TOKEN_ID_LENGTH}})>`,
  "g",
);

/** Format-preserving email: `{tokenId}@redacted.example`. */
export const FPE_EMAIL_RE = new RegExp(
  `\\b(${TOKEN_ID_CHAR_CLASS}{${TOKEN_ID_LENGTH}})@redacted\\.example\\b`,
  "g",
);

/** Format-preserving phone: `+1555` + 7 digits. */
export const FPE_PHONE_RE = /\+1555(\d{7})\b/g;

/**
 * Format-preserving card: starts with 9, digits with optional separators.
 * Narrow enough to avoid matching arbitrary numbers in prose.
 */
export const FPE_CARD_RE = /\b(9(?:[\d][\s-]?){12,18}\d)\b/g;

/** Normalize a raw value for deterministic token derivation. */
export function normalizeValue(entity: EntityClass, value: string): string {
  const trimmed = value.trim();
  if (entity === "email") return trimmed.toLowerCase();
  if (entity === "phone" || entity === "credit_card") return trimmed.replace(/\D/g, "");
  return trimmed;
}

/** Uppercase entity label used inside `<LABEL_id>` tokens. */
export function entityLabel(entity: EntityClass): string {
  return entity.toUpperCase();
}

/** Build a label token from entity + 8-char token id. */
export function labelToken(entity: EntityClass, tokenId: string): string {
  return `<${entityLabel(entity)}_${tokenId}>`;
}

/** workflowKey = HMAC-SHA256(masterKey, workflowId). */
export async function deriveWorkflowKey(
  masterKey: Uint8Array,
  workflowId: string,
): Promise<Uint8Array> {
  return hmacSha256(masterKey, textEncoder.encode(workflowId));
}

/**
 * tokenId = customBase36(HMAC-SHA256(workflowKey, entity || 0x00 || normalized))[0..8]
 * Alphabet is {@link TOKEN_ID_ALPHABET} (not RFC 4648) - see alphabet.ts.
 */
export async function deriveTokenId(
  workflowKey: Uint8Array,
  entity: EntityClass,
  normalizedValue: string,
): Promise<string> {
  const entityBytes = textEncoder.encode(entity);
  const valueBytes = textEncoder.encode(normalizedValue);
  const msg = new Uint8Array(entityBytes.length + 1 + valueBytes.length);
  msg.set(entityBytes, 0);
  msg[entityBytes.length] = 0;
  msg.set(valueBytes, entityBytes.length + 1);
  const mac = await hmacSha256(workflowKey, msg);
  return bytesToTokenId(mac);
}

function tokenIdToDigits(tokenId: string, count: number): string {
  let out = "";
  let acc = 0;
  for (let i = 0; out.length < count; i++) {
    const c = tokenId.charCodeAt(i % tokenId.length);
    acc = (acc * 33 + c + i) >>> 0;
    out += String(acc % 10);
  }
  return out.slice(0, count);
}

function luhnCheckDigit(payloadWithoutCheck: string): number {
  let sum = 0;
  let alt = true;
  for (let i = payloadWithoutCheck.length - 1; i >= 0; i--) {
    let n = Number(payloadWithoutCheck[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return (10 - (sum % 10)) % 10;
}

function formatPreserveCard(original: string, tokenId: string): string {
  const digits = original.replace(/\D/g, "");
  const len = Math.max(digits.length, 13);
  const bodyLen = len - 1;
  let body = tokenIdToDigits(tokenId, bodyLen);
  body = "9" + body.slice(1);
  const check = luhnCheckDigit(body);
  const fake = body + String(check);

  // Re-apply original grouping (non-digit separators stay in place).
  let di = 0;
  let out = "";
  for (let i = 0; i < original.length; i++) {
    const ch = original[i]!;
    if (/\d/.test(ch)) {
      out += fake[di] ?? "0";
      di++;
    } else {
      out += ch;
    }
  }
  while (di < fake.length) {
    out += fake[di]!;
    di++;
  }
  return out;
}

/**
 * Format a token for substitution. `preserve` for email/phone/credit_card;
 * everything else falls back to label form.
 *
 * Unsupported `format: "preserve"` should already have been warned at compilePolicy time;
 * this runtime fallback is a last resort if apply is called without compiling.
 */
export function formatToken(
  entity: EntityClass,
  tokenId: string,
  format: "preserve" | "label" | undefined,
  originalValue: string,
): string {
  if (format === "preserve") {
    if (entity === "email") return `${tokenId}@redacted.example`;
    if (entity === "phone") return `+1555${tokenIdToDigits(tokenId, 7)}`;
    if (entity === "credit_card") return formatPreserveCard(originalValue, tokenId);
    getConsole()?.warn(
      `[tailrace] format: "preserve" is not supported for entity "${entity}"; falling back to label token`,
    );
  }
  return labelToken(entity, tokenId);
}

/** Mask replacement: `[EMAIL]`, `[API_KEY]`, etc. */
export function maskLabel(entity: EntityClass): string {
  return `[${entityLabel(entity)}]`;
}

export { FORMAT_PRESERVE_ENTITIES };
