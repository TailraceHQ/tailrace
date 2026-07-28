/**
 * Wrap Eve `defineTool` execute at the tool boundary (docs/integrations.md §15).
 */

import {
  asCheckable,
  checkWithOpts,
  formatToolBlockError,
  unwrapCheckable,
} from "@tailrace/adapter";
import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";

import type { EveToolDefinition, EveWrapOptions } from "./types";
import { resolveEveWorkflowId } from "./workflow-id";

/**
 * Wrap one Eve tool so its `execute` runs args (`out`) and return (`in`) through policy.
 * `name` must match the tool's filename under `agent/tools/` so policy keys stay predictable.
 * Blocked ⇒ throws value-free `Error` (`formatToolBlockError`), which Eve surfaces to the model.
 *
 * @example
 * ```ts
 * export default governTool(tailrace, "crm", defineTool({ description, inputSchema, execute }));
 * ```
 */
export function governTool<D extends EveToolDefinition>(
  tailrace: Tailrace,
  name: string,
  def: D,
  opts?: EveWrapOptions,
): D {
  if (typeof def.execute !== "function") return def;

  const original = def.execute.bind(def);

  const execute = async (input: unknown, ...rest: unknown[]): Promise<unknown> => {
    const workflowId = resolveEveWorkflowId(opts, rest[0]);
    const wrapOpts = { ...opts, workflowId };

    let checkedArgs: unknown = input;
    try {
      const { output } = await checkWithOpts(
        tailrace,
        asCheckable(input),
        { kind: "tool", name, direction: "out" },
        wrapOpts,
      );
      checkedArgs = unwrapCheckable(input, output);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }

    const result = await original(checkedArgs, ...rest);

    try {
      const { output } = await checkWithOpts(
        tailrace,
        asCheckable(result),
        { kind: "tool", name, direction: "in" },
        wrapOpts,
      );
      return unwrapCheckable(result, output);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        throw new Error(formatToolBlockError(err));
      }
      throw err;
    }
  };

  // why: Eve's defineTool stamps a non-enumerable DEFINITION_KEY (read during agent
  // resolution via `DEFINITION_KEY in def`) plus a TOOL_BRAND on the definition object.
  // Spreading into a new object ({ ...def }) drops the non-enumerable key and changes
  // object identity, which breaks Eve's tool resolution. Reassign execute in place so
  // every stamp, the object identity, and the prototype are preserved.
  (def as { execute: typeof execute }).execute = execute;
  return def;
}

/**
 * Wrap a name→definition map (e.g. re-exporting a directory barrel). Keys are tool names.
 *
 * @example
 * ```ts
 * const tools = governTools(tailrace, { crm: crmTool }, { agent: "support" });
 * ```
 */
export function governTools<D extends Record<string, EveToolDefinition>>(
  tailrace: Tailrace,
  defs: D,
  opts?: EveWrapOptions,
): D {
  const out = {} as Record<string, EveToolDefinition>;
  for (const [name, def] of Object.entries(defs)) {
    out[name] = governTool(tailrace, name, def, opts);
  }
  return out as D;
}
