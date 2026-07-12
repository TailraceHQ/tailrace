/**
 * Associate a master key with a Vault instance so createTailrace can derive tokens
 * for pre-built memoryVault / kvVault instances.
 */

import type { Vault } from "../types";

const vaultKeys = new WeakMap<Vault, Uint8Array>();

/** Register the master key used by a built-in vault adapter. */
export function registerVaultKey(vault: Vault, masterKey: Uint8Array): void {
  vaultKeys.set(vault, masterKey);
}

/** Retrieve a previously registered master key, if any. */
export function getVaultKey(vault: Vault): Uint8Array | undefined {
  return vaultKeys.get(vault);
}
