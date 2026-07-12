/**
 * `tailrace install-hooks` - non-destructive Claude Code settings merge.
 */

import { flagString, type ParsedArgs } from "../internal/args";
import { defaultCompiledConfig, writeCompiledConfig, readCompiledConfig } from "../internal/config";
import { resolveProjectPaths, resolveUserSettingsPath } from "../internal/paths";
import { installHooksAtPath } from "../internal/settings-merge";
import { randomVaultKey } from "../templates/config";

/**
 * Run `tailrace install-hooks`.
 */
export async function runInstallHooks(args: ParsedArgs): Promise<number> {
  const scope = flagString(args.flags, "scope") ?? "project";
  if (scope !== "project" && scope !== "user") {
    process.stderr.write("usage: tailrace install-hooks [--scope project|user]\n");
    return 1;
  }

  const paths = resolveProjectPaths();
  const settingsPath = scope === "user" ? resolveUserSettingsPath() : paths.projectSettingsPath;

  // Ensure compiled JSON config exists (JSON-first Claude Code path).
  try {
    await readCompiledConfig(paths.configPath);
  } catch {
    await writeCompiledConfig(paths.configPath, defaultCompiledConfig(randomVaultKey()));
    process.stdout.write(`Wrote ${paths.configPath}\n`);
  }

  const result = installHooksAtPath(settingsPath);

  if (result.backedUpTo !== null) {
    process.stdout.write(`Backup: ${result.backedUpTo}\n`);
  }
  if (result.added.length > 0) {
    process.stdout.write(`Added Tailrace hooks to ${settingsPath}: ${result.added.join(", ")}\n`);
  }
  if (result.alreadyPresent.length > 0) {
    process.stdout.write(`Already present (skipped): ${result.alreadyPresent.join(", ")}\n`);
  }
  if (result.added.length === 0 && result.alreadyPresent.length > 0) {
    process.stdout.write("No changes.\n");
  }

  return 0;
}
