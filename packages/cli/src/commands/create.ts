/**
 * `tailrace create <target> [dir]` - scaffold a governed agent app.
 *
 * Distinct from `tailrace init` (config into an existing project).
 */

import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { flagBool, type ParsedArgs } from "../internal/args";
import { resolveCliPackageVersion, resolveTemplatesRoot } from "../internal/templates-root";

export const CREATE_TARGETS = ["next", "cloudflare", "openai"] as const;
export type CreateTarget = (typeof CREATE_TARGETS)[number];

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".toml",
  ".txt",
  ".example",
  ".gitignore",
  ".d.ts",
]);

function isCreateTarget(value: string): value is CreateTarget {
  return (CREATE_TARGETS as readonly string[]).includes(value);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirEmpty(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return true;
  const entries = await readdir(dir);
  return entries.length === 0;
}

function packageNameFromDir(dir: string): string {
  const base = basename(resolve(dir));
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "tailrace-agent";
}

function shouldRewriteAsText(relPath: string): boolean {
  const name = basename(relPath);
  if (name === "gitignore" || name === ".env.example" || name.endsWith(".example")) {
    return true;
  }
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = name.slice(dot);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // multi-dot: worker-configuration.d.ts
  if (name.endsWith(".d.ts")) return true;
  return false;
}

function applyPlaceholders(
  content: string,
  vars: { packageName: string; version: string },
): string {
  return content
    .replaceAll("__PACKAGE_NAME__", vars.packageName)
    .replaceAll("__TAILRACE_VERSION__", vars.version);
}

async function copyTemplateTree(
  srcDir: string,
  destDir: string,
  vars: { packageName: string; version: string },
  rel = "",
): Promise<string[]> {
  const written: string[] = [];
  const entries = await readdir(join(srcDir, rel), { withFileTypes: true });
  for (const entry of entries) {
    const relPath = rel ? join(rel, entry.name) : entry.name;
    const from = join(srcDir, relPath);
    // npm strips a literal `.gitignore` from published tarballs, so templates ship
    // it as `gitignore`; restore the dot on write.
    const destName = entry.name === "gitignore" ? ".gitignore" : entry.name;
    const relDest = rel ? join(rel, destName) : destName;
    const to = join(destDir, relDest);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      written.push(...(await copyTemplateTree(srcDir, destDir, vars, relPath)));
      continue;
    }
    await mkdir(join(to, ".."), { recursive: true });
    if (shouldRewriteAsText(relPath)) {
      const raw = await readFile(from, "utf8");
      await writeFile(to, applyPlaceholders(raw, vars), "utf8");
    } else {
      await copyFile(from, to);
    }
    written.push(to);
  }
  return written;
}

function detectInstallCommand(): { cmd: string; args: string[] } {
  const ua = process.env["npm_config_user_agent"] ?? "";
  if (ua.includes("pnpm")) return { cmd: "pnpm", args: ["install"] };
  if (ua.includes("yarn")) return { cmd: "yarn", args: ["install"] };
  if (ua.includes("bun")) return { cmd: "bun", args: ["install"] };
  return { cmd: "npm", args: ["install"] };
}

function runInstall(cwd: string): Promise<number> {
  const { cmd, args } = detectInstallCommand();
  return new Promise((resolveCode) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      process.stderr.write(`install failed to start (${cmd}): ${err.message}\n`);
      resolveCode(1);
    });
    child.on("close", (code) => resolveCode(code ?? 1));
  });
}

function verifyHints(target: CreateTarget, dir: string): string {
  const rel = dir;
  switch (target) {
    case "next":
      return `Next steps:
  cd ${rel}
  cp .env.example .env.local
  npm install   # skip if you used --install
  npm run dev

Verify (with dev server running):
  # Run A - expect 422 api_key
  curl -s -X POST http://localhost:3000/api/chat \\
    -H 'content-type: application/json' \\
    -d '{"prompt":"Use sk_test_51FakeKeyForTailraceTests000FAKE"}'

  # Run B - expect modelSaw with <EMAIL_…>
  curl -s -X POST http://localhost:3000/api/chat \\
    -H 'content-type: application/json' \\
    -H 'x-workflow-id: local-verify' \\
    -d '{"prompt":"Please email customer@example.com about the invoice."}'
`;
    case "cloudflare":
      return `Next steps:
  cd ${rel}
  cp .env.example .dev.vars
  npm install   # skip if you used --install
  npm run verify
  npm run dev

Verify (with wrangler dev running):
  curl -s -X POST http://127.0.0.1:8787/api/chat \\
    -H 'content-type: application/json' \\
    -d '{"prompt":"Use sk_test_51FakeKeyForTailraceTests000FAKE"}'
`;
    case "openai":
      return `Next steps:
  cd ${rel}
  cp .env.example .env
  npm install   # skip if you used --install
  npm run verify

Live agent (requires OPENAI_API_KEY):
  npm start
`;
  }
}

/**
 * Run `tailrace create`.
 */
export async function runCreate(args: ParsedArgs): Promise<number> {
  const force = flagBool(args.flags, "force");
  const install = flagBool(args.flags, "install");
  const targetRaw = args.positional[0];
  const dirArg = args.positional[1] ?? "my-agent";

  if (targetRaw === undefined || targetRaw === "help" || targetRaw === "--help") {
    process.stdout.write(`Usage: tailrace create <target> [dir] [--force] [--install]

Targets:
  next         Next.js App Router + AI SDK (@tailrace/ai-sdk)
  cloudflare   Cloudflare Worker + @tailrace/cloudflare-agents (KV vault)
  openai       @openai/agents + @tailrace/openai-agents

Options:
  --force      Allow non-empty destination directory
  --install    Run package manager install after scaffolding

Examples:
  tailrace create next my-agent
  tailrace create cloudflare my-agent --install
  tailrace create openai ./agents/support
`);
    return targetRaw === undefined ? 1 : 0;
  }

  if (!isCreateTarget(targetRaw)) {
    process.stderr.write(
      `unknown create target: ${targetRaw}\nExpected one of: ${CREATE_TARGETS.join(", ")}\n`,
    );
    return 1;
  }

  const target = targetRaw;
  const destDir = resolve(process.cwd(), dirArg);

  if (await pathExists(destDir)) {
    const st = await stat(destDir);
    if (!st.isDirectory()) {
      process.stderr.write(`destination exists and is not a directory: ${destDir}\n`);
      return 1;
    }
    if (!(await isDirEmpty(destDir)) && !force) {
      process.stderr.write(
        `destination is not empty: ${destDir}\nUse --force to overwrite/merge into a non-empty directory.\n`,
      );
      return 1;
    }
  } else {
    await mkdir(destDir, { recursive: true });
  }

  const templatesRoot = resolveTemplatesRoot();
  const templateDir = join(templatesRoot, target);
  if (!(await pathExists(join(templateDir, "package.json")))) {
    process.stderr.write(`template missing for target: ${target}\n`);
    return 1;
  }

  const version = resolveCliPackageVersion();
  const packageName = packageNameFromDir(destDir);
  const vars = { packageName, version };

  const files = await copyTemplateTree(templateDir, destDir, vars);
  process.stdout.write(`Created ${target} agent in ${destDir}\n`);
  process.stdout.write(`Pinned @tailrace/* to ${version} (${files.length} files)\n`);

  if (install) {
    process.stdout.write("\nInstalling dependencies…\n");
    const code = await runInstall(destDir);
    if (code !== 0) {
      process.stderr.write(`install exited with code ${code}\n`);
      return code;
    }
  }

  process.stdout.write(`\n${verifyHints(target, dirArg)}`);
  return 0;
}
