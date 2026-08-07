/**
 * Process-wide plane store singleton (survives Next.js HMR in dev).
 */

import { MemoryPlaneStore } from "./memory";
import type { PlaneStore } from "./types";

const globalForStore = globalThis as typeof globalThis & {
  __tailracePlaneStore?: PlaneStore;
};

export function getStore(): PlaneStore {
  if (globalForStore.__tailracePlaneStore === undefined) {
    globalForStore.__tailracePlaneStore = new MemoryPlaneStore();
  }
  return globalForStore.__tailracePlaneStore;
}

/** Test-only: replace the singleton. */
export function setStoreForTests(store: PlaneStore): void {
  globalForStore.__tailracePlaneStore = store;
}
