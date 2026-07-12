/**
 * Runtime validation of policy documents. Throws at definePolicy / compile time so
 * misconfiguration surfaces immediately, not on the first request.
 */

import { NotImplementedError, PolicyValidationError } from "../errors";
import type { Action, EntityRuleValue, PolicyDocument, PolicyScope } from "../types";
import { isEgressBoundaryKey } from "./boundary";
import { normalizeRule } from "./normalize";

const VALID_ACTIONS: ReadonlySet<Action> = new Set([
  "allow",
  "mask",
  "tokenize",
  "block",
  "review",
  "detokenize",
]);

function assertAction(action: Action, path: string, underEgress: boolean): void {
  if (!VALID_ACTIONS.has(action)) {
    throw new PolicyValidationError(`unknown action "${String(action)}"`, path);
  }
  if (action === "review") {
    throw new NotImplementedError("review action ships in v0.2");
  }
  // SPEC-QUESTION: detokenize as Action - docs describe egress invert semantics but do not
  // add detokenize to the Action union. Locked: Action includes detokenize; valid only under
  // egress boundary keys in definePolicy.
  if (action === "detokenize" && !underEgress) {
    throw new PolicyValidationError("detokenize is only valid under egress boundary keys", path);
  }
}

function validateRuleValue(value: EntityRuleValue, path: string, underEgress: boolean): void {
  const rule = normalizeRule(value);
  assertAction(rule.action, `${path}.action`, underEgress);
  if (rule.format !== undefined && rule.format !== "preserve" && rule.format !== "label") {
    throw new PolicyValidationError(`unknown format "${String(rule.format)}"`, `${path}.format`);
  }
}

function validateEntities(
  entities: Partial<Record<string, EntityRuleValue>> | undefined,
  path: string,
  underEgress: boolean,
): void {
  if (entities === undefined) return;
  for (const [entity, value] of Object.entries(entities)) {
    if (value === undefined) continue;
    validateRuleValue(value, `${path}.${entity}`, underEgress);
  }
}

function validateScope(scope: PolicyScope, path: string): void {
  validateEntities(scope.entities, `${path}.entities`, false);
  if (scope.boundaries === undefined) return;
  for (const [key, body] of Object.entries(scope.boundaries)) {
    const underEgress = isEgressBoundaryKey(key);
    validateEntities(body?.entities, `${path}.boundaries.${key}.entities`, underEgress);
  }
}

/**
 * Validate a policy document. Throws {@link PolicyValidationError} or
 * {@link NotImplementedError} on failure.
 */
export function validatePolicy(doc: PolicyDocument): void {
  if (doc.defaults?.action !== undefined) {
    assertAction(doc.defaults.action, "defaults.action", false);
  }
  validateScope(doc, "");
  if (doc.identities === undefined) return;
  for (const [agent, scope] of Object.entries(doc.identities)) {
    validateScope(scope, `identities.${agent}`);
  }
}
