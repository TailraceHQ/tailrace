/**
 * Fluent attach for OpenAI Agents helpers.
 */

import type { Tailrace } from "@tailrace/core";
import type { FunctionTool } from "@openai/agents";

import type { OpenAiAgentsWrapOptions, TailraceWithOpenAiAgents } from "./types";
import { wrapTool, wrapTools } from "./wrap-tools";

/**
 * Attach fluent `.tool` / `.tools` helpers to a Tailrace instance.
 *
 * @example
 * ```ts
 * const t = withOpenAiAgents(createTailrace());
 * const tools = t.tools([crmTool], { agent: "support" });
 * ```
 */
export function withOpenAiAgents(tailrace: Tailrace): TailraceWithOpenAiAgents {
  return Object.assign(tailrace, {
    tool<T extends FunctionTool>(tool: T, opts?: OpenAiAgentsWrapOptions): T {
      return wrapTool(tailrace, tool, opts);
    },
    tools<T extends FunctionTool[]>(tools: [...T], opts?: OpenAiAgentsWrapOptions): [...T] {
      return wrapTools(tailrace, tools, opts);
    },
  });
}
