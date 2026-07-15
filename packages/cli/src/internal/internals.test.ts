import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveProjectDir, resolveProjectPaths } from "./paths";
import {
  mergeTailraceHooks,
  installHooksAtPath,
  TAILRACE_HOOK_COMMAND,
  parseSettingsJson,
} from "./settings-merge";
import {
  defaultCompiledConfig,
  isCompiledCliConfig,
  readCompiledConfig,
  writeCompiledConfig,
  type CompiledCliConfig,
} from "./config";
import { createFsKvStore } from "./vault-fs";
import { parseArgs, flagBool } from "./args";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop()!;
    rmSync(d, { recursive: true, force: true });
  }
  delete process.env.CLAUDE_PROJECT_DIR;
});

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "tailrace-cli-"));
  dirs.push(d);
  return d;
}

describe("parseArgs", () => {
  it("parses command, flags, and positionals", () => {
    const args = parseArgs(["scan", "./src", "--json", "--scope", "user"]);
    expect(args.command).toBe("scan");
    expect(args.positional).toEqual(["./src"]);
    expect(flagBool(args.flags, "json")).toBe(true);
    expect(args.flags.get("scope")).toBe("user");
  });
});

describe("paths", () => {
  it("uses CLAUDE_PROJECT_DIR when set", () => {
    process.env.CLAUDE_PROJECT_DIR = "/tmp/proj";
    expect(resolveProjectDir()).toBe("/tmp/proj");
  });

  it("resolves .tailrace paths under project", () => {
    const d = tempDir();
    const paths = resolveProjectPaths(d);
    expect(paths.configPath).toBe(join(d, ".tailrace", "config.json"));
    expect(paths.projectSettingsPath).toBe(join(d, ".claude", "settings.json"));
  });
});

describe("settings-merge", () => {
  it("appends to empty settings", () => {
    const { settings, added } = mergeTailraceHooks({});
    expect(added).toEqual(["PreToolUse", "PostToolUse"]);
    expect(settings.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(TAILRACE_HOOK_COMMAND);
  });

  it("preserves unrelated hooks and is idempotent", () => {
    const existing = parseSettingsJson(
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo hi" }],
            },
          ],
        },
      }),
    );
    const first = mergeTailraceHooks(existing);
    expect(first.added).toEqual(["PreToolUse", "PostToolUse"]);
    expect(first.settings.hooks?.PreToolUse).toHaveLength(2);

    const second = mergeTailraceHooks(first.settings);
    expect(second.added).toEqual([]);
    expect(second.alreadyPresent).toEqual(["PreToolUse", "PostToolUse"]);
    expect(second.settings.hooks?.PreToolUse).toHaveLength(2);
  });

  it("writes backup and settings file", () => {
    const d = tempDir();
    const settingsPath = join(d, ".claude", "settings.json");
    mkdirSync(join(d, ".claude"), { recursive: true });
    writeFileSync(settingsPath, `${JSON.stringify({ permissions: {} }, null, 2)}\n`);

    const result = installHooksAtPath(settingsPath);
    expect(result.backedUpTo).not.toBeNull();
    expect(result.added).toEqual(["PreToolUse", "PostToolUse"]);
    const written = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks: { PreToolUse: unknown[] };
    };
    expect(written.hooks.PreToolUse.length).toBe(1);
  });
});

describe("config", () => {
  it("round-trips compiled config", async () => {
    const d = tempDir();
    const path = join(d, ".tailrace", "config.json");
    const config = defaultCompiledConfig("abcd");
    await writeCompiledConfig(path, config);
    const loaded = await readCompiledConfig(path);
    expect(loaded).toEqual(config);
    expect(isCompiledCliConfig(loaded)).toBe(true);
  });

  it("accepts v2 config with recognizers", async () => {
    const d = tempDir();
    const path = join(d, ".tailrace", "config.json");
    const config: CompiledCliConfig = {
      version: 2,
      agent: "claude-code",
      vaultKey: "abcd",
      recognizers: [
        {
          id: "employee-id",
          entity: "employee_id",
          tier: 0,
          patterns: [{ source: String.raw`\bEMP-\d{5}\b` }],
        },
      ],
      policy: {
        entities: { employee_id: "tokenize" },
        defaults: { action: "allow" },
      },
    };
    await writeCompiledConfig(path, config);
    const loaded = await readCompiledConfig(path);
    expect(loaded.recognizers).toHaveLength(1);
    expect(isCompiledCliConfig(loaded)).toBe(true);
  });
});

describe("vault-fs", () => {
  it("stores and retrieves values", async () => {
    const d = tempDir();
    const kv = createFsKvStore(join(d, "vault"));
    await kv.put("wf:tok", "ciphertext");
    expect(await kv.get("wf:tok")).toBe("ciphertext");
    await kv.delete("wf:tok");
    expect(await kv.get("wf:tok")).toBeNull();
  });
});
