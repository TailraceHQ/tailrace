/**
 * Policy resolution (docs/policy-engine.md §3). Pure and synchronous.
 */

import {
  NER_ENTITY_CLASSES,
  PII_ENTITY_CLASSES,
  SECRET_ENTITY_CLASSES,
  type Action,
  type Boundary,
  type EntityClass,
  type EntityRule,
  type Identity,
} from "../types";
import { boundaryKey, matchBoundaryPatterns } from "./boundary";
import type { CompiledBoundary, CompiledIdentity, CompiledPolicy } from "./compile";

/** Restrictiveness ranking for overlap collapse (docs/policy-engine.md §3.4). */
export const ACTION_RANK: Readonly<Record<Action, number>> = {
  block: 5,
  review: 4,
  tokenize: 3,
  detokenize: 3,
  mask: 2,
  allow: 1,
};

const SECRET_SET: ReadonlySet<string> = new Set(SECRET_ENTITY_CLASSES);
const BLOCK_PII_SET: ReadonlySet<string> = new Set([...PII_ENTITY_CLASSES, ...NER_ENTITY_CLASSES]);

/** Return the more restrictive of two actions. */
export function moreRestrictive(a: Action, b: Action): Action {
  return ACTION_RANK[a] >= ACTION_RANK[b] ? a : b;
}

export interface ResolvedRule {
  action: Action;
  rule: string;
  format?: "preserve" | "label";
  dangerouslyAllowSecrets?: boolean;
}

interface Candidate {
  rule: EntityRule;
  path: string;
}

// SPEC-QUESTION: block-pii membership - docs mention the pseudo-class but do not define
// membership. Locked: all PiiEntityClass + NerEntityClass.
function lookupEntity(
  entities: Map<string, EntityRule>,
  entity: EntityClass,
  pathPrefix: string,
): Candidate | null {
  // Exact > block-pii > *
  const exact = entities.get(entity);
  if (exact !== undefined) return { rule: exact, path: `${pathPrefix}.${entity}` };
  if (BLOCK_PII_SET.has(entity)) {
    const blockPii = entities.get("block-pii");
    if (blockPii !== undefined) return { rule: blockPii, path: `${pathPrefix}.block-pii` };
  }
  const star = entities.get("*");
  if (star !== undefined) return { rule: star, path: `${pathPrefix}.*` };
  return null;
}

function findBoundaryCandidate(
  boundaries: CompiledBoundary[],
  patterns: string[],
  key: string,
  entity: EntityClass,
  pathPrefix: string,
): Candidate | null {
  const matched = matchBoundaryPatterns(key, patterns);
  for (const pattern of matched) {
    const compiled = boundaries.find((b) => b.pattern === pattern);
    if (compiled === undefined) continue;
    const hit = lookupEntity(compiled.entities, entity, `${pathPrefix}.${pattern}.entities`);
    if (hit !== null) return hit;
  }
  return null;
}

function collectCandidates(
  policy: CompiledPolicy,
  entity: EntityClass,
  boundary: Boundary,
  identity: Identity,
): Candidate[] {
  const key = boundaryKey(boundary);
  const agent = identity.agent || "default";
  const out: Candidate[] = [];

  const push = (c: Candidate | null): void => {
    if (c !== null) out.push(c);
  };

  const ident: CompiledIdentity | undefined = policy.identities.get(agent);
  if (ident !== undefined) {
    // a. identities[I].boundaries[B].entities[E]
    push(
      findBoundaryCandidate(
        ident.boundaries,
        ident.boundaryPatterns,
        key,
        entity,
        `identities.${agent}.boundaries`,
      ),
    );
    // b. identities[I].entities[E]
    push(lookupEntity(ident.entities, entity, `identities.${agent}.entities`));
  }

  // c. boundaries[B].entities[E]
  push(
    findBoundaryCandidate(policy.boundaries, policy.boundaryPatterns, key, entity, "boundaries"),
  );

  // d. entities[E]
  push(lookupEntity(policy.entities, entity, "entities"));

  // e. defaults.action
  out.push({
    rule: { action: policy.defaultsAction },
    path: "defaults.action",
  });

  return out;
}

/**
 * Resolve the action for one (entity × boundary × identity) triple.
 *
 * @example
 * ```ts
 * const { action, rule } = resolve(compiled, "email", boundary, { agent: "default" });
 * ```
 */
export function resolve(
  policy: CompiledPolicy,
  entity: EntityClass,
  boundary: Boundary,
  identity: Identity,
): ResolvedRule {
  const candidates = collectCandidates(policy, entity, boundary, identity);
  const winning = candidates[0]!;
  let action = winning.rule.action;
  let path = winning.path;
  let format = winning.rule.format;
  let dangerouslyAllowSecrets = winning.rule.dangerouslyAllowSecrets === true;

  // Secrets-cannot-be-allowed: block at any level cannot be overridden to allow by a more
  // specific rule unless dangerouslyAllowSecrets is set on the winning rule or document.
  if (
    SECRET_SET.has(entity) &&
    action === "allow" &&
    !dangerouslyAllowSecrets &&
    !policy.dangerouslyAllowSecrets
  ) {
    for (const c of candidates) {
      if (c.rule.action === "block") {
        action = "block";
        path = c.path;
        format = c.rule.format;
        dangerouslyAllowSecrets = c.rule.dangerouslyAllowSecrets === true;
        break;
      }
    }
  }

  return {
    action,
    rule: path.replace(/^\./, ""),
    ...(format !== undefined ? { format } : {}),
    ...(dangerouslyAllowSecrets ? { dangerouslyAllowSecrets: true } : {}),
  };
}
