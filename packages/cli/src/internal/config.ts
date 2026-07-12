/**
 * Precompiled Claude Code / CLI config (JSON-first hot path).
 */

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  createTailrace,
  jsonlSink,
  kvVault,
  type PolicyDocument,
  type Tailrace,
} from "@tailrace/core";
import { createFsAuditWriter } from "./audit-fs";
import { createFsKvStore } from "./vault-fs";
import type { ProjectPaths } from "./paths";

export const COMPILED_CONFIG_VERSION = 1 as const;

export interface CompiledCliConfig {
  version: typeof COMPILED_CONFIG_VERSION;
  agent: string;
  /** Stable vault key (hex/string). Prefer `TAILRACE_VAULT_KEY` env in prod. */
  vaultKey?: string;
  /** Serialized policy. Omit ⇒ default policy. */
  policy?: PolicyDocument;
}

export function defaultCompiledConfig(vaultKey: string): CompiledCliConfig {
  return {
    version: COMPILED_CONFIG_VERSION,
    agent: "claude-code",
    vaultKey,
  };
}

export function isCompiledCliConfig(value: unknown): value is CompiledCliConfig {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.version === COMPILED_CONFIG_VERSION && typeof v.agent === "string";
}

export function readCompiledConfigSync(path: string): CompiledCliConfig {
  let raw: string;
  try {
    // Sync for hook hot path (spawn-to-exit budget).
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(
        `missing Tailrace config at ${path}; run \`tailrace init\` or \`tailrace install-hooks\``,
      );
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invalid JSON in Tailrace config at ${path}`);
  }
  if (!isCompiledCliConfig(parsed)) {
    throw new Error(`unsupported or invalid Tailrace config at ${path} (expected version: 1)`);
  }
  return parsed;
}

export async function readCompiledConfig(path: string): Promise<CompiledCliConfig> {
  return readCompiledConfigSync(path);
}

export async function writeCompiledConfig(path: string, config: CompiledCliConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

/**
 * Build a Tailrace instance for the Claude Code hook / CLI from compiled config + paths.
 */
export function createTailraceFromConfig(config: CompiledCliConfig, paths: ProjectPaths): Tailrace {
  const key = process.env.TAILRACE_VAULT_KEY ?? config.vaultKey;
  const vault = kvVault(createFsKvStore(paths.vaultDir), key !== undefined ? { key } : undefined);
  const auditWriter = createFsAuditWriter(paths.auditPath);
  return createTailrace({
    ...(config.policy !== undefined ? { policy: config.policy } : {}),
    vault,
    audit: { sinks: [jsonlSink(auditWriter)] },
  });
}
