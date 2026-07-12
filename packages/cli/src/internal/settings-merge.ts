/**
 * Non-destructive merge of Tailrace hook entries into Claude Code settings.json.
 *
 * Verified against https://code.claude.com/docs/en/hooks (omit matcher or `"*"` =
 * all tools). Command string locked: `tailrace hook`.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Substring used to detect an already-installed Tailrace hook (idempotent). */
export const TAILRACE_HOOK_MARKER = "tailrace hook";

export const TAILRACE_HOOK_COMMAND = "tailrace hook";

export interface ClaudeHookHandler {
  type: "command";
  command: string;
}

export interface ClaudeMatcherGroup {
  matcher?: string;
  hooks: ClaudeHookHandler[];
}

export interface ClaudeSettings {
  hooks?: {
    PreToolUse?: ClaudeMatcherGroup[];
    PostToolUse?: ClaudeMatcherGroup[];
    [event: string]: ClaudeMatcherGroup[] | undefined;
  };
  [key: string]: unknown;
}

export interface MergeHooksResult {
  settings: ClaudeSettings;
  added: string[];
  alreadyPresent: string[];
  backedUpTo: string | null;
}

function hasTailraceCommand(groups: ClaudeMatcherGroup[] | undefined): boolean {
  if (groups === undefined) return false;
  for (const group of groups) {
    for (const hook of group.hooks) {
      if (hook.type === "command" && hook.command.includes(TAILRACE_HOOK_MARKER)) {
        return true;
      }
    }
  }
  return false;
}

function tailraceMatcherGroup(): ClaudeMatcherGroup {
  return {
    matcher: "*",
    hooks: [{ type: "command", command: TAILRACE_HOOK_COMMAND }],
  };
}

/**
 * Merge Tailrace PreToolUse + PostToolUse hooks into a settings object.
 */
export function mergeTailraceHooks(existing: ClaudeSettings): {
  settings: ClaudeSettings;
  added: string[];
  alreadyPresent: string[];
} {
  const hooks = { ...(existing.hooks ?? {}) };
  const added: string[] = [];
  const alreadyPresent: string[] = [];

  for (const event of ["PreToolUse", "PostToolUse"] as const) {
    const groups = hooks[event] ?? [];
    if (hasTailraceCommand(groups)) {
      alreadyPresent.push(event);
      hooks[event] = groups;
      continue;
    }
    hooks[event] = [...groups, tailraceMatcherGroup()];
    added.push(event);
  }

  return {
    settings: { ...existing, hooks },
    added,
    alreadyPresent,
  };
}

export function parseSettingsJson(raw: string | null): ClaudeSettings {
  if (raw === null || raw.trim() === "") return {};
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("settings.json must be a JSON object");
  }
  return parsed as ClaudeSettings;
}

/**
 * Backup (if present), merge Tailrace hooks, write settings.json.
 */
export function installHooksAtPath(settingsPath: string): MergeHooksResult {
  let raw: string | null = null;
  if (existsSync(settingsPath)) {
    raw = readFileSync(settingsPath, "utf8");
  }

  let backedUpTo: string | null = null;
  if (raw !== null) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backedUpTo = `${settingsPath}.bak-${stamp}`;
    copyFileSync(settingsPath, backedUpTo);
  }

  const existing = parseSettingsJson(raw);
  const { settings, added, alreadyPresent } = mergeTailraceHooks(existing);

  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");

  return { settings, added, alreadyPresent, backedUpTo };
}
