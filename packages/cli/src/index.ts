/**
 * @tailrace/cli - programmatic entry for the `tailrace` binary.
 *
 * Commands (docs/integrations.md §4): `init` (scaffold config for the detected stack),
 * `scan` (Tier 0 secret scan of files/stdin; usable as a pre-commit hook), `install-hooks`
 * (non-destructive merge of Claude Code hook entries with a backup), and `hook` (the hook
 * handler itself, p50 < 150ms). M0 skeleton: command dispatch lands in M4.
 */

import { NotImplementedError } from "@tailrace/core";

export const COMMANDS = ["init", "scan", "install-hooks", "hook"] as const;
export type Command = (typeof COMMANDS)[number];

/**
 * Run a `tailrace` CLI command. Returns the process exit code.
 *
 * @example
 * ```ts
 * const code = await run(["scan", "./src"]);
 * ```
 */
export async function run(argv: string[]): Promise<number> {
  void argv;
  throw new NotImplementedError("the `tailrace` CLI lands in milestone M4 (docs/milestones.md)");
}
