/**
 * Detokenization at trusted egress boundaries (docs/vault.md §4).
 */

import { InvariantViolationError } from "../errors";
import { isEgressBoundaryKey, boundaryKey } from "../policy/boundary";
import type { Boundary, Decision, EntityClass, Identity, JsonObject, Vault } from "../types";
import { sha256Hex } from "../vault/crypto";
import { FPE_CARD_RE, FPE_EMAIL_RE, FPE_PHONE_RE, LABEL_RE } from "../vault/token";
import { cloneJson, getStringAtPointer, setStringAtPointer } from "./pointer";

export interface RestoreContext {
  vault: Vault;
  workflowId: string;
  boundary: Boundary;
  identity: Identity;
}

interface TokenHit {
  start: number;
  end: number;
  token: string;
  entity: EntityClass;
  path: string;
}

function findTokensInLeaf(leaf: string, path: string): TokenHit[] {
  const hits: TokenHit[] = [];

  LABEL_RE.lastIndex = 0;
  for (const m of leaf.matchAll(LABEL_RE)) {
    const full = m[0]!;
    const label = m[1]!;
    const idx = m.index ?? 0;
    hits.push({
      start: idx,
      end: idx + full.length,
      token: full,
      entity: label.toLowerCase() as EntityClass,
      path,
    });
  }

  FPE_EMAIL_RE.lastIndex = 0;
  for (const m of leaf.matchAll(FPE_EMAIL_RE)) {
    const full = m[0]!;
    const idx = m.index ?? 0;
    hits.push({
      start: idx,
      end: idx + full.length,
      token: full,
      entity: "email",
      path,
    });
  }

  FPE_PHONE_RE.lastIndex = 0;
  for (const m of leaf.matchAll(FPE_PHONE_RE)) {
    const full = m[0]!;
    const idx = m.index ?? 0;
    hits.push({
      start: idx,
      end: idx + full.length,
      token: full,
      entity: "phone",
      path,
    });
  }

  FPE_CARD_RE.lastIndex = 0;
  for (const m of leaf.matchAll(FPE_CARD_RE)) {
    const full = m[0]!;
    const idx = m.index ?? 0;
    hits.push({
      start: idx,
      end: idx + full.length,
      token: full,
      entity: "credit_card",
      path,
    });
  }

  // Deduplicate overlapping hits preferring label tokens (more specific).
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const deduped: TokenHit[] = [];
  for (const hit of hits) {
    const overlap = deduped.some((d) => hit.start < d.end && hit.end > d.start);
    if (!overlap) deduped.push(hit);
  }
  return deduped;
}

function collectLeaves(input: string | JsonObject): Array<{ path: string; text: string }> {
  if (typeof input === "string") {
    return [{ path: "", text: input }];
  }
  const out: Array<{ path: string; text: string }> = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      out.push({ path, text: value });
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) walk(value[i], `${path}/${i}`);
      return;
    }
    for (const [k, v] of Object.entries(value as JsonObject)) {
      const esc = k.replace(/~/g, "~0").replace(/\//g, "~1");
      walk(v, `${path}/${esc}`);
    }
  };
  walk(input, "");
  return out;
}

/**
 * Restore vault tokens in `input`. Throws {@link InvariantViolationError} when the
 * boundary is not egress - detokenize never happens elsewhere.
 */
export async function restoreInput<T extends string | JsonObject>(
  input: T,
  ctx: RestoreContext,
): Promise<{ output: T; decisions: Decision[] }> {
  const key = boundaryKey(ctx.boundary);
  if (!isEgressBoundaryKey(key) || ctx.boundary.kind !== "egress") {
    throw new InvariantViolationError("restore is only allowed at egress boundaries");
  }

  let output: string | JsonObject = typeof input === "string" ? input : cloneJson(input);
  const decisions: Decision[] = [];
  const leaves = collectLeaves(input);

  for (const leaf of leaves) {
    const hits = findTokensInLeaf(leaf.text, leaf.path);
    // Right-to-left by offset.
    hits.sort((a, b) => b.start - a.start);

    let text =
      typeof output === "string" ? output : (getStringAtPointer(output, leaf.path) ?? leaf.text);

    for (const hit of hits) {
      const record = await ctx.vault.get(ctx.workflowId, hit.token);
      const contentHash = await sha256Hex(hit.token);
      if (record === null) {
        decisions.push({
          action: "restore_miss",
          entity: hit.entity,
          boundary: ctx.boundary,
          identity: ctx.identity,
          rule: "restore",
          span: { path: hit.path, start: hit.start, end: hit.end },
          contentHash,
        });
        continue;
      }
      text = text.slice(0, hit.start) + record.value + text.slice(hit.end);
      decisions.push({
        action: "detokenize",
        entity: record.entity,
        boundary: ctx.boundary,
        identity: ctx.identity,
        rule: "restore",
        span: { path: hit.path, start: hit.start, end: hit.end },
        contentHash,
      });
    }

    if (typeof output === "string") {
      output = text;
    } else {
      setStringAtPointer(output, leaf.path, text);
    }
  }

  decisions.sort((a, b) => a.span.start - b.span.start || a.span.path.localeCompare(b.span.path));
  return { output: output as T, decisions };
}
