/**
 * wrapTools — type-preserving tool execute wrappers (docs/integrations.md §1.3).
 */

import type { JsonObject, JsonValue, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import type { ToolSet } from "ai";

import { checkWithOpts } from "./internal/context";
import { formatToolBlockError } from "./internal/errors";
import type { AiSdkWrapOptions } from "./types";

function asCheckable(value: unknown): string | JsonObject {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  // Arrays / primitives: wrap so object-scan can walk string leaves.
  // Deferred: wrapping as `{ value }` can collide with a tool that natively
  // returns `{ value: ... }` when unwrapping - see OPEN_QUESTIONS.md.
  return { value: value as JsonValue };
}

function unwrapCheckable(original: unknown, checked: string | JsonObject): unknown {
  if (typeof original === "string") return checked;
  if (original === null || original === undefined) return original;
  if (typeof original === "object" && !Array.isArray(original)) return checked;
  if (
    typeof checked === "object" &&
    checked !== null &&
    "value" in checked &&
    (Array.isArray(original) || typeof original === "number" || typeof original === "boolean")
  ) {
    return (checked as JsonObject)["value"];
  }
  return checked;
}

/**
 * Wrap a tool set so each tool's args (`out`) and return value (`in`) pass through
 * policy. Preserves the tool set's type exactly.
 *
 * @example
 * ```ts
 * const tools = wrapTools(tailrace, { crm: crmTool }, { agent: "support" });
 * ```
 */
export function wrapTools<T extends ToolSet>(
  tailrace: Tailrace,
  tools: T,
  opts?: AiSdkWrapOptions,
): T {
  const out: Record<string, unknown> = {};

  for (const name of Object.keys(tools)) {
    const tool = tools[name];
    if (tool === undefined || tool === null || typeof tool !== "object") {
      out[name] = tool;
      continue;
    }

    const execute = "execute" in tool ? tool.execute : undefined;
    if (typeof execute !== "function") {
      out[name] = tool;
      continue;
    }

    const wrappedExecute = async (args: unknown, options: unknown) => {
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

      // why: ToolExecuteFunction generics vary per tool; preserve runtime arity.
      const result = await (execute as (a: unknown, o: unknown) => Promise<unknown>)(
        checkedArgs,
        options,
      );

      const inBoundary = {
        kind: "tool" as const,
        name,
        direction: "in" as const,
      };
      try {
        const { output } = await checkWithOpts(tailrace, asCheckable(result), inBoundary, opts);
        return unwrapCheckable(result, output);
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          throw new Error(formatToolBlockError(err));
        }
        throw err;
      }
    };

    out[name] = { ...tool, execute: wrappedExecute };
  }

  return out as T;
}
