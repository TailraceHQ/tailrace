/**
 * Public types for @tailrace/openai-agents.
 */

import type { Decision, Tailrace } from "@tailrace/core";
import type { FunctionTool } from "@openai/agents";

export interface OpenAiAgentsWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Tailrace instance with fluent OpenAI Agents helpers.
 */
export interface TailraceWithOpenAiAgents extends Tailrace {
  tools<T extends FunctionTool[]>(tools: [...T], opts?: OpenAiAgentsWrapOptions): [...T];
  tool<T extends FunctionTool>(tool: T, opts?: OpenAiAgentsWrapOptions): T;
}
