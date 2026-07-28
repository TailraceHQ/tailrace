/**
 * Fluent attach for Eve helpers.
 */

import type { Tailrace } from "@tailrace/core";

import { governTool, governTools } from "./govern-tool";
import type { EveToolDefinition, EveWrapOptions, TailraceWithEve } from "./types";

/**
 * Attach fluent `.tool` / `.tools` helpers to a Tailrace instance.
 *
 * @example
 * ```ts
 * const t = withEve(createTailrace());
 * export default t.tool("crm", defineTool({ ... }), { agent: "support" });
 * ```
 */
export function withEve(tailrace: Tailrace): TailraceWithEve {
  return Object.assign(tailrace, {
    tool<D extends EveToolDefinition>(name: string, def: D, opts?: EveWrapOptions): D {
      return governTool(tailrace, name, def, opts);
    },
    tools<D extends Record<string, EveToolDefinition>>(defs: D, opts?: EveWrapOptions): D {
      return governTools(tailrace, defs, opts);
    },
  });
}
