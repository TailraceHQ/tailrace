/**
 * @tailrace/ai-sdk - Vercel AI SDK middleware (flagship integration).
 *
 * Integrations contain zero policy logic: they build a `Boundary`/`Identity`, call
 * `check`/`restore`, and translate `PolicyViolationError` into the host's failure mode
 * (docs/integrations.md §1). M0 skeleton: signatures are stable, bodies land in M3.
 */

import { NotImplementedError, type Decision, type Tailrace } from "@tailrace/core";

export interface AiSdkWrapOptions {
  agent?: string;
  workflowId?: string | (() => string);
  onDecision?: (decisions: Decision[]) => void;
}

// SPEC-QUESTION: bind the exact AI SDK host types (LanguageModel / ToolSet) and the fluent
// `tailrace.model(...)` / `tailrace.tools(...)` form in M3, verified against the installed
// `ai` version's middleware signature (docs/integrations.md §1). Tracked in OPEN_QUESTIONS.md.

/**
 * Wrap a language model so prompt messages (model boundary, `out`) and generated output
 * (model boundary, `in`) pass through policy. Returns the same model type.
 *
 * @example
 * ```ts
 * const model = wrapModel(tailrace, openai("gpt-4o"), { agent: "support" });
 * ```
 */
export function wrapModel<TModel>(
  tailrace: Tailrace,
  model: TModel,
  opts?: AiSdkWrapOptions,
): TModel {
  throw new NotImplementedError(
    "@tailrace/ai-sdk wrapModel lands in milestone M3 (docs/milestones.md)",
  );
}

/**
 * Wrap a tool set so each tool's args (tool boundary, `out`) and return value (tool
 * boundary, `in`) pass through policy. Preserves the tool set's type exactly.
 *
 * @example
 * ```ts
 * const tools = wrapTools(tailrace, { crm: crmTool }, { agent: "support" });
 * ```
 */
export function wrapTools<TTools>(
  tailrace: Tailrace,
  tools: TTools,
  opts?: AiSdkWrapOptions,
): TTools {
  throw new NotImplementedError(
    "@tailrace/ai-sdk wrapTools lands in milestone M3 (docs/milestones.md)",
  );
}
