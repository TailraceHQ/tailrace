/**
 * Resolve bundled create-template directory (shipped next to package root).
 */

import { accessSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function moduleDir(): string {
  // Bundled CJS bin: __dirname is dist/. Vitest ESM: import.meta.url is this file.
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // why: CJS fallback when import.meta.url is unavailable
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
}

function hasTemplates(dir: string): boolean {
  try {
    accessSync(join(dir, "next", "package.json"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from this module until `templates/next/package.json` exists.
 */
export function resolveTemplatesRoot(): string {
  let dir = moduleDir();
  for (;;) {
    const candidate = join(dir, "templates");
    if (hasTemplates(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("could not locate Tailrace create templates (expected packages/cli/templates)");
}

/**
 * Pin published @tailrace/* deps to this CLI package version.
 */
export function resolveCliPackageVersion(): string {
  let dir = moduleDir();
  for (;;) {
    const pkgPath = join(dir, "package.json");
    try {
      const raw = readFileSync(pkgPath, "utf8");
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      if (pkg.name === "@tailrace/cli" && typeof pkg.version === "string") {
        return pkg.version;
      }
    } catch {
      // continue walk
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "0.1.0";
}
