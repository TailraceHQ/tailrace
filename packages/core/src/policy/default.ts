/**
 * Zero-config default policy document.
 *
 * // SPEC-QUESTION: Default policy document - AGENTS.md says secrets → block and common
 * // PII → tokenize, but does not enumerate NER or egress. Locked: secrets block; all
 * // PiiEntityClass tokenize; NER unset (falls to defaults.allow); egress:* → detokenize.
 */

import {
  PII_ENTITY_CLASSES,
  SECRET_ENTITY_CLASSES,
  type EntityClass,
  type EntityRuleValue,
  type PolicyDocument,
} from "../types";

/**
 * Build the default policy enforced by `createTailrace()` with no args.
 *
 * @example
 * ```ts
 * const policy = defaultPolicy();
 * // secrets block, emails tokenize, egress:* detokenize
 * ```
 */
export function defaultPolicy(): PolicyDocument {
  const entities: Partial<Record<EntityClass, EntityRuleValue>> = {};
  for (const entity of SECRET_ENTITY_CLASSES) {
    entities[entity] = "block";
  }
  for (const entity of PII_ENTITY_CLASSES) {
    entities[entity] = "tokenize";
  }
  return {
    defaults: { action: "allow" },
    entities,
    boundaries: {
      "egress:*": { entities: { "*": "detokenize" } },
    },
  };
}
