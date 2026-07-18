/**
 * Pure OpenAI-compat pipeline helpers (no host Context).
 */

import type { Boundary, Tailrace } from "@tailrace/core";

import { checkWithOpts } from "./check";
import {
  applyCompletionText,
  extractCompletionText,
  extractMessageTextTree,
  modelBoundaryFromBody,
  type OpenAiChatBody,
} from "./openai-body";
import type { OpenAiCompatIdentityOpts } from "./types";

/**
 * Check and rewrite an OpenAI chat request body in place.
 * Throws `PolicyViolationError` on block.
 *
 * @example
 * ```ts
 * await runOpenAiCompatRequestCheck(tr, body, { agent: "api", workflowId: "w1" });
 * ```
 */
export async function runOpenAiCompatRequestCheck(
  tailrace: Tailrace,
  body: OpenAiChatBody,
  opts?: OpenAiCompatIdentityOpts,
): Promise<{ boundary: Boundary; body: OpenAiChatBody }> {
  const boundary = modelBoundaryFromBody(body);
  const { tree, apply } = extractMessageTextTree(body);
  const { output } = await checkWithOpts(tailrace, tree, boundary, opts);
  apply(output);
  return { boundary, body };
}

/**
 * Check and rewrite a non-SSE chat completion JSON body.
 * Returns the (possibly rewritten) body. Throws `PolicyViolationError` on block.
 * Returns the original body unchanged when there is no assistant text to scan.
 *
 * @example
 * ```ts
 * const next = await runOpenAiCompatJsonResponseCheck(tr, json, boundary, opts);
 * ```
 */
export async function runOpenAiCompatJsonResponseCheck(
  tailrace: Tailrace,
  json: unknown,
  boundary: Boundary,
  opts?: OpenAiCompatIdentityOpts,
): Promise<unknown> {
  const text = extractCompletionText(json);
  if (text.length === 0) return json;
  const { output } = await checkWithOpts(tailrace, text, boundary, opts);
  return applyCompletionText(json, output);
}
