/**
 * Shared vault record encoding and storage key helpers.
 */

import { VaultError } from "../errors";
import type { EntityClass, VaultRecord } from "../types";
import { decryptAtRest, encryptAtRest } from "./crypto";

export interface EncodedVaultRecord {
  entity: EntityClass;
  ciphertext: string;
  expiresAt?: number;
}

/** Storage key: `tailrace:v1:{workflowId}:{token}`. */
export function storageKey(workflowId: string, token: string): string {
  return `tailrace:v1:${workflowId}:${token}`;
}

/** Encrypt and JSON-encode a vault record for storage. */
export async function encodeRecord(
  masterKey: Uint8Array,
  record: VaultRecord,
  expiresAt?: number,
): Promise<string> {
  const ciphertext = await encryptAtRest(masterKey, record.value);
  const encoded: EncodedVaultRecord = {
    entity: record.entity,
    ciphertext,
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
  return JSON.stringify(encoded);
}

/** Decode and decrypt a stored vault record. Returns null if expired. */
export async function decodeRecord(
  masterKey: Uint8Array,
  raw: string,
  now: number = Date.now(),
): Promise<(VaultRecord & { expiresAt?: number }) | null> {
  let parsed: EncodedVaultRecord;
  try {
    parsed = JSON.parse(raw) as EncodedVaultRecord;
  } catch {
    throw new VaultError("corrupt vault record");
  }
  if (parsed.expiresAt !== undefined && parsed.expiresAt <= now) {
    return null;
  }
  const value = await decryptAtRest(masterKey, parsed.ciphertext);
  return {
    value,
    entity: parsed.entity,
    ...(parsed.expiresAt !== undefined ? { expiresAt: parsed.expiresAt } : {}),
  };
}

/**
 * Ensure an existing vault entry for `token` stores the same plaintext.
 * Different value for the same token id is a collision (docs/vault.md §3).
 */
export function assertNoCollision(
  existing: VaultRecord | null,
  value: string,
  token: string,
): void {
  if (existing !== null && existing.value !== value) {
    throw new VaultError(`token collision for ${token}`);
  }
}
