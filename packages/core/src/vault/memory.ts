/**
 * In-memory vault with TTL sweep. Default vault for createTailrace().
 */

import type { Vault, VaultOptions, VaultPutInput, VaultRecord } from "../types";
import { resolveMasterKey } from "./crypto";
import { registerVaultKey } from "./keys";
import { assertNoCollision, decodeRecord, encodeRecord, storageKey } from "./shared";

const DEFAULT_TTL_SECONDS = 86_400;

interface MemoryEntry {
  raw: string;
  expiresAt?: number;
}

/**
 * Create an in-memory vault. Values are encrypted at rest with the resolved master key.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ vault: memoryVault({ key: "dev-only-key" }) });
 * ```
 */
export function memoryVault(opts?: VaultOptions): Vault {
  const masterKey = resolveMasterKey(opts?.key);
  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const store = new Map<string, MemoryEntry>();

  const sweep = (now: number): void => {
    for (const [key, entry] of store) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  };

  const vault: Vault = {
    async put(input: VaultPutInput): Promise<void> {
      const now = Date.now();
      sweep(now);
      const key = storageKey(input.workflowId, input.token);
      const existingRaw = store.get(key);
      if (existingRaw !== undefined) {
        const existing = await decodeRecord(masterKey, existingRaw.raw, now);
        assertNoCollision(existing, input.value, input.token);
        if (existing !== null) return; // idempotent same-value put
      }
      const expiresAt = input.expiresAt ?? (ttlSeconds > 0 ? now + ttlSeconds * 1000 : undefined);
      const raw = await encodeRecord(
        masterKey,
        { value: input.value, entity: input.entity },
        expiresAt,
      );
      store.set(key, {
        raw,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      });
    },

    async get(workflowId: string, token: string): Promise<VaultRecord | null> {
      const now = Date.now();
      sweep(now);
      const entry = store.get(storageKey(workflowId, token));
      if (entry === undefined) return null;
      const decoded = await decodeRecord(masterKey, entry.raw, now);
      if (decoded === null) {
        store.delete(storageKey(workflowId, token));
        return null;
      }
      return { value: decoded.value, entity: decoded.entity };
    },

    async purge(workflowId: string): Promise<void> {
      const prefix = `tailrace:v1:${workflowId}:`;
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
      }
    },
  };

  registerVaultKey(vault, masterKey);
  return vault;
}
