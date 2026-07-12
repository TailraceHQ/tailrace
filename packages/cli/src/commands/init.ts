/**
 * `tailrace init` - scaffold config for the detected stack.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { flagBool, type ParsedArgs } from "../internal/args";
import { defaultCompiledConfig, writeCompiledConfig } from "../internal/config";
import { resolveProjectPaths } from "../internal/paths";
import {
  configTsTemplate,
  detectStack,
  integrationSnippet,
  randomVaultKey,
  type DetectedStack,
} from "../templates/config";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readNearestPackageJson(projectDir: string): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null> {
  try {
    const raw = await readFile(join(projectDir, "package.json"), "utf8");
    return JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

/**
 * Run `tailrace init`.
 */
export async function runInit(args: ParsedArgs): Promise<number> {
  const force = flagBool(args.flags, "force");
  const paths = resolveProjectPaths();
  const configTsPath = join(paths.projectDir, "tailrace.config.ts");

  if ((await exists(configTsPath)) && !force) {
    process.stderr.write(`tailrace.config.ts already exists (use --force to overwrite)\n`);
    return 1;
  }

  const pkg = (await readNearestPackageJson(paths.projectDir)) ?? {};
  const stack: DetectedStack = detectStack(pkg);

  await writeFile(configTsPath, configTsTemplate(), "utf8");
  await mkdir(paths.tailraceDir, { recursive: true });
  await writeCompiledConfig(paths.configPath, defaultCompiledConfig(randomVaultKey()));

  process.stdout.write(`Wrote ${configTsPath}\n`);
  process.stdout.write(`Wrote ${paths.configPath} (hook hot path)\n`);
  process.stdout.write(`Detected stack: ${stack}\n\n`);
  process.stdout.write("Next steps:\n");
  process.stdout.write(`${integrationSnippet(stack)}\n`);
  if (stack === "node") {
    process.stdout.write("\nThen: tailrace install-hooks\n");
  }

  return 0;
}
