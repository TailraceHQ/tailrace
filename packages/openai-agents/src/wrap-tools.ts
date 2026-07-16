/**
 * Wrap OpenAI Agents SDK FunctionTool.invoke (docs/integrations.md §7).
 *
 * Bound against @openai/agents@0.3.x: FunctionTool exposes `invoke(runContext, input: string)`
 * (user-facing `execute` in tool() options is compiled into invoke). Hosted tools are out of scope.
 */

import {
  asCheckable,
  checkWithOpts,
  formatToolBlockError,
  unwrapCheckable,
} from "@tailrace/adapter";
import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import type { FunctionTool } from "@openai/agents";

import type { OpenAiAgentsWrapOptions } from "./types";

function parseToolInput(input: string): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return input;
  }
}

function serializeToolInput(original: string, checked: unknown): string {
  if (typeof checked === "string") return checked;
  try {
    return JSON.stringify(checked);
  } catch {
    return original;
  }
}

/**
 * Wrap a single FunctionTool so invoke args/results pass through policy.
 *
 * @example
 * ```ts
 * const crm = wrapTool(tailrace, tool({ name: "crm", ... }), { agent: "support" });
 * ```
 */
export function wrapTool<T extends FunctionTool>(
  tailrace: Tailrace,
  fnTool: T,
  opts?: OpenAiAgentsWrapOptions,
): T {
  if (fnTool.type !== "function" || typeof fnTool.invoke !== "function") {
    return fnTool;
  }

  const name = fnTool.name;
  const originalInvoke = fnTool.invoke.bind(fnTool);

  const wrappedInvoke: typeof fnTool.invoke = async (runContext, input, details) => {
    const parsed = parseToolInput(input);
    let checkedInput = input;
    try {
      const { output } = await checkWithOpts(
        tailrace,
        asCheckable(parsed),
        { kind: "tool", name, direction: "out" },
        opts,
      );
      const unwrapped = unwrapCheckable(parsed, output);
      checkedInput = serializeToolInput(input, unwrapped);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }

    const result = await originalInvoke(runContext, checkedInput, details);

    try {
      const { output } = await checkWithOpts(
        tailrace,
        asCheckable(result),
        { kind: "tool", name, direction: "in" },
        opts,
      );
      return unwrapCheckable(result, output) as typeof result;
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }
  };

  return { ...fnTool, invoke: wrappedInvoke };
}

/**
 * Wrap an array of FunctionTools. Non-function tools pass through unchanged.
 *
 * @example
 * ```ts
 * const tools = wrapTools(tailrace, [crmTool, searchTool], { agent: "support" });
 * ```
 */
export function wrapTools<T extends FunctionTool[]>(
  tailrace: Tailrace,
  tools: [...T],
  opts?: OpenAiAgentsWrapOptions,
): [...T] {
  return tools.map((t) => wrapTool(tailrace, t, opts)) as [...T];
}
