/**
 * @tailrace/cli - programmatic entry for the `tailrace` binary.
 *
 * Commands (docs/integrations.md §4): `init`, `scan`, `install-hooks`, `hook`.
 */

import { runHook } from "./commands/hook";
import { runInit } from "./commands/init";
import { runInstallHooks } from "./commands/install-hooks";
import { runScan } from "./commands/scan";
import { parseArgs } from "./internal/args";
import { formatCliError } from "./internal/errors";

export const COMMANDS = ["init", "scan", "install-hooks", "hook"] as const;
export type Command = (typeof COMMANDS)[number];

const HELP = `Usage: tailrace <command> [options]

Commands:
  init              Scaffold tailrace.config.ts + .tailrace/config.json
  scan <path|->     Tier 0 scan; exit 1 on block-class entities [--json]
  install-hooks     Merge Claude Code PreToolUse/PostToolUse hooks [--scope project|user]
  hook              Claude Code hook handler (stdin JSON → stdout JSON)

Docs: https://github.com/tailrace/tailrace
`;

/**
 * Run a `tailrace` CLI command. Returns the process exit code.
 *
 * @example
 * ```ts
 * const code = await run(["scan", "./src"]);
 * ```
 */
export async function run(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const command = args.command;

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return 0;
  }

  try {
    switch (command) {
      case "init":
        return await runInit(args);
      case "scan":
        return await runScan(args);
      case "install-hooks":
        return await runInstallHooks(args);
      case "hook":
        return await runHook();
      default:
        process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
        return 1;
    }
  } catch (err) {
    process.stderr.write(`${formatCliError(err)}\n`);
    return 1;
  }
}

export { handleHookEvent } from "./commands/hook";
export type { HookEvent, HookResult } from "./commands/hook";
