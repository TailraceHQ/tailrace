/**
 * Opt-in recommended policy fragment for Tier 1 (M8-3 option C).
 * Does not auto-merge when registering nerRecognizer().
 */

import type { Action, EntityClass, EntityRuleValue, PolicyDocument } from "@tailrace/core";

export interface NerRecommendedPolicyOptions {
  /**
   * Action for free-text NER entities that are unset in defaultPolicy (`person`,
   * `private_address`, `account_number`, `private_url`, `private_date`, `location`,
   * `organization`). Default `tokenize`.
   */
  nerPiiAction?: Exclude<Action, "detokenize" | "review">;
}

/**
 * Build a policy fragment users can merge into `createTailrace({ policy })`.
 * Does not include `secret` → `block` (already in core `defaultPolicy` via SecretEntityClass).
 * Does not change `email` / `phone` (already tokenize in core defaults).
 *
 * @example
 * ```ts
 * import { createTailrace, definePolicy } from "@tailrace/core";
 * import { nerRecognizer, nerRecommendedPolicy } from "@tailrace/recognizer-ner";
 *
 * const recommended = nerRecommendedPolicy();
 * const gate = createTailrace({
 *   policy: definePolicy({ entities: { ...recommended.entities } }),
 *   recognizers: [nerRecognizer({ modelPath })],
 * });
 * ```
 */
export function nerRecommendedPolicy(
  opts: NerRecommendedPolicyOptions = {},
): Pick<PolicyDocument, "entities"> {
  const action: EntityRuleValue = opts.nerPiiAction ?? "tokenize";
  const entities: Partial<Record<EntityClass, EntityRuleValue>> = {
    person: action,
    location: action,
    organization: action,
    account_number: action,
    private_address: action,
    private_url: action,
    private_date: action,
  };
  return { entities };
}
