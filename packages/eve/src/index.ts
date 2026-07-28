/**
 * @tailrace/eve - govern Vercel Eve agent tools (docs/integrations.md §15).
 * Wraps `defineTool` execute at the tool boundary. Zero policy logic; core + adapter only.
 */

export { governTool, governTools } from "./govern-tool";
export { withEve } from "./fluent";
export type { EveWrapOptions, EveToolDefinition, TailraceWithEve } from "./types";
