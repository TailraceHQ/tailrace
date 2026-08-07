/**
 * API key helpers - WebCrypto only (hash for storage, never log raw keys in audit).
 */

const PREFIX = "tr_live_";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Generate a project/environment API key (`tr_live_…`). */
export async function generateApiKey(): Promise<{ raw: string; hash: string; prefix: string }> {
  const rand = new Uint8Array(24);
  crypto.getRandomValues(rand);
  const raw = `${PREFIX}${bytesToBase64Url(rand)}`;
  const hash = await hashApiKey(raw);
  return { raw, hash, prefix: raw.slice(0, 12) };
}

export async function hashApiKey(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export function lookLikeApiKey(value: string): boolean {
  return value.startsWith(PREFIX) && value.length >= 20;
}
