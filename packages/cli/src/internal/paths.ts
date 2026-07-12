/**
 * Resolve project / Tailrace / Claude Code settings paths.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export interface ProjectPaths {
  projectDir: string;
  tailraceDir: string;
  configPath: string;
  vaultDir: string;
  auditPath: string;
  projectSettingsPath: string;
}

/**
 * Project root is `$CLAUDE_PROJECT_DIR` when set (Claude Code hook env), else `cwd`.
 */
export function resolveProjectDir(cwd: string = process.cwd()): string {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  return cwd;
}

export function resolveProjectPaths(cwd?: string): ProjectPaths {
  const projectDir = resolveProjectDir(cwd);
  const tailraceDir = join(projectDir, ".tailrace");
  return {
    projectDir,
    tailraceDir,
    configPath: join(tailraceDir, "config.json"),
    vaultDir: join(tailraceDir, "vault"),
    auditPath: join(tailraceDir, "audit.jsonl"),
    projectSettingsPath: join(projectDir, ".claude", "settings.json"),
  };
}

export function resolveUserSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}
