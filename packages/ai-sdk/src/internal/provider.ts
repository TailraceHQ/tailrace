/**
 * Encode a language model as a policy boundary provider string
 * (docs/integrations.md §1.1).
 */

import type { LanguageModelV2 } from "@ai-sdk/provider";

/**
 * `${providerId}/${modelId}`, unless `modelId` already contains `/` (gateway-style),
 * in which case it is used as-is. Falls back to `providerId` alone when `modelId`
 * is empty.
 *
 * @example
 * ```ts
 * encodeModelProvider({ provider: "openai", modelId: "gpt-4o" }); // "openai/gpt-4o"
 * encodeModelProvider({ provider: "gateway", modelId: "openai/gpt-4o" }); // "openai/gpt-4o"
 * ```
 */
export function encodeModelProvider(model: Pick<LanguageModelV2, "provider" | "modelId">): string {
  const providerId = model.provider?.trim() ?? "";
  const modelId = model.modelId?.trim() ?? "";
  if (modelId.includes("/")) return modelId;
  if (!modelId) return providerId || "unknown";
  if (!providerId) return modelId;
  return `${providerId}/${modelId}`;
}
