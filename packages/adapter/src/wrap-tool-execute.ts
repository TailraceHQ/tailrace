/**
 * wrapToolExecute — wrap a single tool execute function (docs/integrations.md §6).
 */

import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";

import { asCheckable, unwrapCheckable } from "./checkable";
import { checkWithOpts } from "./context";
import { formatToolBlockError } from "./errors";
import type { AdapterWrapOptions } from "./types";

export type ToolExecuteFn<TArgs = unknown, TResult = unknown> = (
  args: TArgs,
  ...rest: unknown[]
) => TResult | Promise<TResult>;

/**
 * Wrap one tool `execute` so args (`out`) and return value (`in`) pass through policy.
 *
 * On block, throws `Error` with {@link formatToolBlockError} (never the raw value).
 *
 * @example
 * ```ts
 * const execute = wrapToolExecute(tailrace, "crm", originalExecute, { agent: "support" });
 * ```
 */
export function wrapToolExecute<TArgs, TResult>(
  tailrace: Tailrace,
  name: string,
  execute: ToolExecuteFn<TArgs, TResult>,
  opts?: AdapterWrapOptions,
): (args: TArgs, ...rest: unknown[]) => Promise<TResult> {
  return async (args: TArgs, ...rest: unknown[]) => {
    const outBoundary = {
      kind: "tool" as const,
      name,
      direction: "out" as const,
    };
    let checkedArgs: unknown = args;
    try {
      const { output } = await checkWithOpts(tailrace, asCheckable(args), outBoundary, opts);
      checkedArgs = unwrapCheckable(args, output);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }

    const result = await execute(checkedArgs as TArgs, ...rest);

    const inBoundary = {
      kind: "tool" as const,
      name,
      direction: "in" as const,
    };
    try {
      const { output } = await checkWithOpts(tailrace, asCheckable(result), inBoundary, opts);
      return unwrapCheckable(result, output) as TResult;
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }
  };
}
