/**
 * WebCrypto helpers for vault keying, HMAC token ids, and AES-256-GCM at rest.
 * No `node:crypto`, no `Buffer` - Uint8Array + globalThis.crypto only.
 */

import { getConsole } from "../console";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Encode bytes as lowercase hex. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/** Encode bytes as standard base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Decode standard base64 to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function importHmacKey(raw: Uint8Array) {
  return crypto.subtle.importKey("raw", raw.slice(), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

/** HMAC-SHA256(key, message) → 32 bytes. */
export async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await importHmacKey(key);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, message.slice());
  return new Uint8Array(sig);
}

/** SHA-256 hex digest of a UTF-8 string. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

/** Cryptographically random bytes. */
export function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

async function storageKeyMaterial(masterKey: Uint8Array) {
  const derived = await hmacSha256(masterKey, textEncoder.encode("storage"));
  return crypto.subtle.importKey("raw", derived.slice(), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt plaintext at rest: AES-256-GCM with key = HMAC(master, "storage").
 * Returns base64(iv || ciphertext+tag).
 */
export async function encryptAtRest(masterKey: Uint8Array, plaintext: string): Promise<string> {
  const key = await storageKeyMaterial(masterKey);
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.slice() },
    key,
    textEncoder.encode(plaintext),
  );
  const packed = new Uint8Array(iv.length + ct.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ct), iv.length);
  return bytesToBase64(packed);
}

/** Decrypt a value produced by {@link encryptAtRest}. */
export async function decryptAtRest(masterKey: Uint8Array, packedB64: string): Promise<string> {
  const packed = base64ToBytes(packedB64);
  if (packed.length < 13) {
    throw new Error("ciphertext too short");
  }
  const iv = packed.subarray(0, 12);
  const ct = packed.subarray(12);
  const key = await storageKeyMaterial(masterKey);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.slice() }, key, ct.slice());
  return textDecoder.decode(pt);
}

let ephemeralMasterKey: Uint8Array | undefined;
let warnedEphemeral = false;

function envVaultKey(): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.["TAILRACE_VAULT_KEY"];
}

/**
 * Resolve the vault master key: explicit → TAILRACE_VAULT_KEY → ephemeral (with warn).
 */
export function resolveMasterKey(explicit?: string): Uint8Array {
  if (explicit !== undefined && explicit.length > 0) {
    return textEncoder.encode(explicit);
  }
  const fromEnv = envVaultKey();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return textEncoder.encode(fromEnv);
  }
  if (ephemeralMasterKey === undefined) {
    ephemeralMasterKey = randomBytes(32);
    if (!warnedEphemeral) {
      warnedEphemeral = true;
      getConsole()?.warn(
        "[tailrace] No vault key configured; using ephemeral per-process key. Tokens will not survive restarts.",
      );
    }
  }
  return ephemeralMasterKey;
}
