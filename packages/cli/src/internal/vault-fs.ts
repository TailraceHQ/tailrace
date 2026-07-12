/**
 * File-backed KvStore for `kvVault` (persists across hook process spawns).
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { KvStore } from "@tailrace/core";

function safeSegment(key: string): string {
  // storageKey already uses a delimiter; encode for filesystem safety.
  return Buffer.from(key, "utf8").toString("base64url");
}

/**
 * Create a filesystem KvStore under `rootDir`.
 */
export function createFsKvStore(rootDir: string): KvStore {
  const pathFor = (key: string) => join(rootDir, safeSegment(key));

  return {
    async get(key: string): Promise<string | null> {
      try {
        return await readFile(pathFor(key), "utf8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw err;
      }
    },
    async put(key: string, value: string): Promise<void> {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value, "utf8");
    },
    async delete(key: string): Promise<void> {
      try {
        await rm(pathFor(key), { force: true });
      } catch {
        // ignore
      }
    },
  };
}
