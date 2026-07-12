/**
 * Zero-config default policy document.
 *
 * Explicit per-entity choices (not a blanket "all PII tokenize"):
 * - secrets → block
 * - common structured PII (email, phone, card, iban, ssn) → tokenize
 * - ip_address → allow (IPs appear in legitimate flows; blanket tokenization is aggressive)
 * - url_credentials → block (credential-in-URL shape is secret-class in practice)
 * - NER entities unset → fall through to defaults.action = allow
 * - egress:* → detokenize
 */

import {
  SECRET_ENTITY_CLASSES,
  type EntityClass,
  type EntityRuleValue,
  type PiiEntityClass,
  type PolicyDocument,
} from "../types";

/** Structured PII tokenized by the zero-config default. */
const DEFAULT_TOKENIZE_PII: readonly PiiEntityClass[] = [
  "email",
  "phone",
  "credit_card",
  "iban",
  "ssn",
];

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
  for (const entity of DEFAULT_TOKENIZE_PII) {
    entities[entity] = "tokenize";
  }
  entities.url_credentials = "block";
  return {
    defaults: { action: "allow" },
    entities,
    boundaries: {
      "egress:*": { entities: { "*": "detokenize" } },
    },
  };
}
