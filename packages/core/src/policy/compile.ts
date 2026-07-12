/**
 * Precompile a policy document into lookup structures for fast per-span resolution.
 */

import { getConsole } from "../console";
import type { Action, EntityRule, EntityRuleValue, PolicyDocument, PolicyScope } from "../types";
import { FORMAT_PRESERVE_ENTITIES } from "../vault/alphabet";
import { normalizeRule } from "./normalize";
import { validatePolicy } from "./validate";

/** One boundary pattern with its entity rules. */
export interface CompiledBoundary {
  pattern: string;
  entities: Map<string, EntityRule>;
}

/** One identity override tree. */
export interface CompiledIdentity {
  entities: Map<string, EntityRule>;
  boundaries: CompiledBoundary[];
  /** Pattern strings in the same order as `boundaries` (for matchBoundaryPatterns). */
  boundaryPatterns: string[];
}

/** Precompiled policy used by {@link resolve}. */
export interface CompiledPolicy {
  defaultsAction: Action;
  dangerouslyAllowSecrets: boolean;
  entities: Map<string, EntityRule>;
  boundaries: CompiledBoundary[];
  boundaryPatterns: string[];
  identities: Map<string, CompiledIdentity>;
}

function compileEntities(
  entities: Partial<Record<string, EntityRuleValue>> | undefined,
): Map<string, EntityRule> {
  const map = new Map<string, EntityRule>();
  if (entities === undefined) return map;
  for (const [key, value] of Object.entries(entities)) {
    if (value === undefined) continue;
    map.set(key, normalizeRule(value));
  }
  return map;
}

function compileBoundaries(boundaries: PolicyScope["boundaries"]): {
  boundaries: CompiledBoundary[];
  boundaryPatterns: string[];
} {
  const compiled: CompiledBoundary[] = [];
  if (boundaries === undefined) {
    return { boundaries: compiled, boundaryPatterns: [] };
  }
  for (const [pattern, body] of Object.entries(boundaries)) {
    compiled.push({
      pattern,
      entities: compileEntities(body?.entities),
    });
  }
  // Exact before glob; longer before shorter - same order as matchBoundaryPatterns.
  compiled.sort((a, b) => {
    const aGlob = a.pattern.includes("*") ? 1 : 0;
    const bGlob = b.pattern.includes("*") ? 1 : 0;
    if (aGlob !== bGlob) return aGlob - bGlob;
    return b.pattern.length - a.pattern.length;
  });
  return {
    boundaries: compiled,
    boundaryPatterns: compiled.map((b) => b.pattern),
  };
}

function compileScope(scope: PolicyScope): CompiledIdentity {
  const entities = compileEntities(scope.entities);
  const { boundaries, boundaryPatterns } = compileBoundaries(scope.boundaries);
  return { entities, boundaries, boundaryPatterns };
}

/**
 * vault.md §3: format:"preserve" outside {email, phone, credit_card} falls back to
 * label tokens with a compile-time warning.
 */
function warnUnsupportedPreserve(entities: Map<string, EntityRule>, path: string): void {
  for (const [entity, rule] of entities) {
    if (rule.format !== "preserve") continue;
    if (FORMAT_PRESERVE_ENTITIES.has(entity)) continue;
    getConsole()?.warn(
      `[tailrace] format: "preserve" is not supported for entity "${entity}" at ${path}.${entity}; falling back to label token`,
    );
  }
}

function warnPreserveFallbacks(compiled: CompiledPolicy): void {
  warnUnsupportedPreserve(compiled.entities, "entities");
  for (const boundary of compiled.boundaries) {
    warnUnsupportedPreserve(boundary.entities, `boundaries.${boundary.pattern}.entities`);
  }
  for (const [agent, ident] of compiled.identities) {
    warnUnsupportedPreserve(ident.entities, `identities.${agent}.entities`);
    for (const boundary of ident.boundaries) {
      warnUnsupportedPreserve(
        boundary.entities,
        `identities.${agent}.boundaries.${boundary.pattern}.entities`,
      );
    }
  }
}

/**
 * Validate and precompile a policy document.
 *
 * @example
 * ```ts
 * const compiled = compilePolicy(definePolicy({ entities: { email: "tokenize" } }));
 * ```
 */
export function compilePolicy(doc: PolicyDocument): CompiledPolicy {
  validatePolicy(doc);
  const { boundaries, boundaryPatterns } = compileBoundaries(doc.boundaries);
  const identities = new Map<string, CompiledIdentity>();
  if (doc.identities !== undefined) {
    for (const [agent, scope] of Object.entries(doc.identities)) {
      identities.set(agent, compileScope(scope));
    }
  }
  const compiled: CompiledPolicy = {
    defaultsAction: doc.defaults?.action ?? "allow",
    dangerouslyAllowSecrets: doc.dangerouslyAllowSecrets === true,
    entities: compileEntities(doc.entities),
    boundaries,
    boundaryPatterns,
    identities,
  };
  warnPreserveFallbacks(compiled);
  return compiled;
}
