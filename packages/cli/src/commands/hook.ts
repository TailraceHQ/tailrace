/**
 * `tailrace hook` - Claude Code PreToolUse / PostToolUse handler.
 *
 * Contract (verified against https://code.claude.com/docs/en/hooks):
 * - Always exit 0 for policy decisions (JSON path exclusively).
 * - PreToolUse deny: permissionDecision "deny" + reason (entity + rule, never value).
 * - PreToolUse tokenize/mask: permissionDecision "allow" + updatedInput (full object).
 * - PreToolUse clean: exit 0, empty stdout.
 * - PostToolUse: audit-only; never rewrite/deny in v0.1.
 */

import { PolicyViolationError, type JsonObject, type JsonValue } from "@tailrace/core";
import { createTailraceFromConfig, readCompiledConfigSync } from "../internal/config";
import { resolveProjectPaths } from "../internal/paths";

export interface HookEvent {
  hook_event_name?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: JsonValue;
  tool_response?: JsonValue;
  [key: string]: unknown;
}

export interface HookResult {
  exitCode: number;
  stdout: string;
}

function asCheckable(value: JsonValue | undefined): string | JsonObject | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value as JsonObject;
  // primitives / arrays: wrap so object-scan can walk (same idea as wrapTools)
  return { value };
}

function inputsEqual(a: JsonValue | undefined, b: string | JsonObject): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function denyStdout(entity: string, rule: string): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Blocked by data policy: ${entity} may not be sent to tool (rule: ${rule})`,
    },
  })}\n`;
}

function allowUpdatedStdout(updatedInput: string | JsonObject): string {
  return `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput,
    },
  })}\n`;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Handle a parsed hook event. Exported for tests.
 */
export async function handleHookEvent(
  event: HookEvent,
  opts?: { cwd?: string },
): Promise<HookResult> {
  const name = event.hook_event_name;
  if (name !== "PreToolUse" && name !== "PostToolUse") {
    return { exitCode: 0, stdout: "" };
  }

  const paths = resolveProjectPaths(opts?.cwd);
  const config = readCompiledConfigSync(paths.configPath);
  const tailrace = createTailraceFromConfig(config, paths);
  const agent = config.agent || "claude-code";
  const workflowId =
    typeof event.session_id === "string" && event.session_id.length > 0
      ? event.session_id
      : "default";
  const toolName =
    typeof event.tool_name === "string" && event.tool_name.length > 0 ? event.tool_name : "unknown";

  if (name === "PostToolUse") {
    const payload = asCheckable(event.tool_response);
    if (payload === null) return { exitCode: 0, stdout: "" };
    try {
      await tailrace.check(payload, {
        boundary: { kind: "tool", name: toolName, direction: "in" },
        identity: { agent },
        workflowId,
      });
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        if (process.env.TAILRACE_DEBUG === "1") {
          process.stderr.write(`[tailrace] PostToolUse policy note: ${err.message}\n`);
        }
        // Audit already emitted inside check; tool already ran - do not deny.
        return { exitCode: 0, stdout: "" };
      }
      throw err;
    }
    return { exitCode: 0, stdout: "" };
  }

  // PreToolUse
  const payload = asCheckable(event.tool_input);
  if (payload === null) return { exitCode: 0, stdout: "" };

  try {
    const { output } = await tailrace.check(payload, {
      boundary: { kind: "tool", name: toolName, direction: "out" },
      identity: { agent },
      workflowId,
    });
    if (inputsEqual(event.tool_input, output)) {
      return { exitCode: 0, stdout: "" };
    }
    // updatedInput must replace the entire tool_input object (Claude Code contract).
    return { exitCode: 0, stdout: allowUpdatedStdout(output) };
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      const first = err.decisions[0];
      const entity = first?.entity ?? "unknown";
      const rule = first?.rule ?? "unknown";
      return { exitCode: 0, stdout: denyStdout(entity, rule) };
    }
    throw err;
  }
}

/**
 * Run `tailrace hook` (stdin → stdout).
 */
export async function runHook(): Promise<number> {
  let raw: string;
  try {
    raw = await readStdin();
  } catch (err) {
    process.stderr.write(
      `tailrace hook: failed to read stdin: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }

  let event: HookEvent;
  try {
    event = JSON.parse(raw) as HookEvent;
  } catch {
    process.stderr.write("tailrace hook: stdin is not valid JSON\n");
    return 1;
  }

  try {
    const result = await handleHookEvent(event);
    if (result.stdout.length > 0) {
      process.stdout.write(result.stdout);
    }
    return result.exitCode;
  } catch (err) {
    process.stderr.write(`tailrace hook: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}
