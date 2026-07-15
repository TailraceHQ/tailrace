/**
 * `tailrace scan` - Tier 0 secret/PII scan; exit 1 on any block-class hit.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { createTailrace, PolicyViolationError, type Decision, type Tailrace } from "@tailrace/core";
import { flagBool, type ParsedArgs } from "../internal/args";
import { createTailraceFromConfig, readCompiledConfig } from "../internal/config";
import { resolveProjectPaths } from "../internal/paths";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  ".next",
  "coverage",
  ".tailrace",
]);

export interface ScanHit {
  path: string;
  entity: string;
  rule: string;
}

const SCAN_BOUNDARY = { kind: "tool" as const, name: "scan", direction: "out" as const };

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env" && entry.name !== ".env.example") {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        // skip other dotdirs
        if (entry.isDirectory()) continue;
      }
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  const st = await stat(root);
  if (st.isFile()) {
    out.push(root);
  } else {
    await walk(root);
  }
  return out;
}

async function scanText(pathLabel: string, text: string, tailrace: Tailrace): Promise<ScanHit[]> {
  try {
    await tailrace.check(text, {
      boundary: SCAN_BOUNDARY,
      identity: { agent: "scan" },
      workflowId: "scan",
    });
    return [];
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      return err.decisions
        .filter((d: Decision) => d.action === "block")
        .map((d) => ({ path: pathLabel, entity: d.entity, rule: d.rule }));
    }
    throw err;
  }
}

/**
 * Run `tailrace scan`.
 */
export async function runScan(args: ParsedArgs): Promise<number> {
  const asJson = flagBool(args.flags, "json");
  const target = args.positional[0];
  if (target === undefined) {
    process.stderr.write("usage: tailrace scan <path|-> [--json]\n");
    return 1;
  }

  const paths = resolveProjectPaths();
  let tailrace: Tailrace;
  try {
    const config = await readCompiledConfig(paths.configPath);
    tailrace = createTailraceFromConfig(config, paths);
  } catch {
    tailrace = createTailrace();
  }
  const hits: ScanHit[] = [];

  if (target === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf8");
    hits.push(...(await scanText("<stdin>", text, tailrace)));
  } else {
    const root = resolve(target);
    const files = await collectFiles(root);
    for (const file of files) {
      const buf = await readFile(file);
      if (looksBinary(buf)) continue;
      const text = buf.toString("utf8");
      const label = relative(process.cwd(), file) || file;
      hits.push(...(await scanText(label, text, tailrace)));
    }
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
  } else if (hits.length === 0) {
    process.stdout.write("ok: no block-class entities found\n");
  } else {
    for (const hit of hits) {
      process.stdout.write(`${hit.path}: blocked ${hit.entity} (rule: ${hit.rule})\n`);
    }
  }

  return hits.length > 0 ? 1 : 0;
}
