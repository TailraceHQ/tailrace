/**
 * @tailrace/http - shared OpenAI-compatible HTTP pipeline (docs/integrations.md §9).
 *
 * Zero host peers. Gateway packages resolve identity from their request, then call these helpers.
 */

export type { OpenAiCompatHttpOptionsBase, OpenAiCompatIdentityOpts } from "./types";
export type { OpenAiChatBody } from "./openai-body";
export type { PolicyViolationBody } from "./errors";
export type { NodeLikeResponse } from "./node-response";

export {
  applyCompletionText,
  extractCompletionText,
  extractMessageTextTree,
  isEventStream,
  modelBoundaryFromBody,
  parseOpenAiBody,
} from "./openai-body";
export { POLICY_VIOLATION_STATUS, policyViolationBody } from "./errors";
export { CARRY_BUFFER_SIZE } from "./carry-buffer";
export { buildCheckContext, checkWithOpts, resolveAgent, resolveWorkflowId } from "./check";
export { createOpenAiCompatSseTransform } from "./sse";
export { runOpenAiCompatJsonResponseCheck, runOpenAiCompatRequestCheck } from "./pipeline";
export { wrapNodeResponse } from "./node-response";
