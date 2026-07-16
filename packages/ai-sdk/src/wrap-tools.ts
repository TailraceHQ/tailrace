/**
 * wrapTools — type-preserving tool execute wrappers (docs/integrations.md §1.3).
 * Delegates execute wrapping to `@tailrace/adapter` (public API).
 */

import { wrapToolExecute } from "@tailrace/adapter";
import type { Tailrace } from "@tailrace/core";
import type { ToolSet } from "ai";

import type { AiSdkWrapOptions } from "./types";

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

    const wrappedExecute = wrapToolExecute(
      tailrace,
      name,
      execute as (args: unknown, options: unknown) => Promise<unknown>,
      opts,
    );

    out[name] = { ...tool, execute: wrappedExecute };
  }

  return out as T;
}
