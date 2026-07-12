/**
 * KV-backed vault (Cloudflare KV and compatible). Values encrypted at rest.
 */

import type { KvStore, Vault, VaultOptions, VaultPutInput, VaultRecord } from "../types";
import { resolveMasterKey } from "./crypto";
import { registerVaultKey } from "./keys";
import { assertNoCollision, decodeRecord, encodeRecord, storageKey } from "./shared";

const DEFAULT_TTL_SECONDS = 86_400;

export { storageKey };

/**
 * Create a vault backed by a minimal KV store.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ vault: kvVault(env.MY_KV, { key: secret }) });
 * ```
 */
export function kvVault(kv: KvStore, opts?: VaultOptions): Vault {
  const masterKey = resolveMasterKey(opts?.key);
  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;

  const vault: Vault = {
    async put(input: VaultPutInput): Promise<void> {
      const key = storageKey(input.workflowId, input.token);
      const existingRaw = await kv.get(key);
      if (existingRaw !== null) {
        const existing = await decodeRecord(masterKey, existingRaw);
        assertNoCollision(existing, input.value, input.token);
        if (existing !== null) return;
      }
      const now = Date.now();
      const expiresAt = input.expiresAt ?? (ttlSeconds > 0 ? now + ttlSeconds * 1000 : undefined);
      const raw = await encodeRecord(
        masterKey,
        { value: input.value, entity: input.entity },
        expiresAt,
      );
      const putOpts =
        expiresAt !== undefined
          ? { expirationTtl: Math.max(1, Math.ceil((expiresAt - now) / 1000)) }
          : ttlSeconds > 0
            ? { expirationTtl: ttlSeconds }
            : undefined;
      if (putOpts !== undefined) {
        await kv.put(key, raw, putOpts);
      } else {
        await kv.put(key, raw);
      }
    },

    async get(workflowId: string, token: string): Promise<VaultRecord | null> {
      const raw = await kv.get(storageKey(workflowId, token));
      if (raw === null) return null;
      const decoded = await decodeRecord(masterKey, raw);
      if (decoded === null) {
        await kv.delete(storageKey(workflowId, token));
        return null;
      }
      return { value: decoded.value, entity: decoded.entity };
    },

    async purge(workflowId: string): Promise<void> {
      // Minimal KvStore has no list API; purge is a no-op for opaque namespaces.
      // Callers that need purge should use memoryVault or a richer adapter.
      void workflowId;
    },
  };

  registerVaultKey(vault, masterKey);
  return vault;
}
