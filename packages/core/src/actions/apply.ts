/**
 * Apply resolved policy actions to string / JSON inputs.
 */

import { PolicyViolationError } from "../errors";
import { moreRestrictive } from "../policy/resolve";
import type { Action, Decision, JsonObject, Span, Vault } from "../types";
import {
  deriveTokenId,
  deriveWorkflowKey,
  formatToken,
  maskLabel,
  normalizeValue,
} from "../vault/token";
import { cloneJson, getStringAtPointer, setStringAtPointer } from "./pointer";

export interface ApplyItem {
  span: Span;
  decision: Decision;
  /** Raw detected substring. */
  value: string;
  format?: "preserve" | "label";
}

export interface ApplyContext {
  vault: Vault;
  masterKey: Uint8Array;
  workflowId: string;
}

interface CollapsedItem extends ApplyItem {
  action: Action;
}

/**
 * When spans overlap, keep the most restrictive action (docs/policy-engine.md §3.4).
 * Items are assumed to share the same path (or be plain-string spans).
 */
export function collapseOverlaps(items: ApplyItem[]): CollapsedItem[] {
  if (items.length === 0) return [];

  const byPath = new Map<string, ApplyItem[]>();
  for (const item of items) {
    const path = item.span.path ?? "";
    const list = byPath.get(path) ?? [];
    list.push(item);
    byPath.set(path, list);
  }

  const out: CollapsedItem[] = [];
  for (const group of byPath.values()) {
    const sorted = [...group].sort(
      (a, b) => a.span.start - b.span.start || b.span.end - a.span.end,
    );
    const kept: CollapsedItem[] = [];
    for (const item of sorted) {
      const action = item.decision.action;
      if (action === "restore_miss") continue;
      const asAction = action as Action;
      let overlaps = false;
      for (let i = 0; i < kept.length; i++) {
        const other = kept[i]!;
        if (item.span.start < other.span.end && item.span.end > other.span.start) {
          overlaps = true;
          const winner = moreRestrictive(asAction, other.action);
          if (winner === asAction && asAction !== other.action) {
            kept[i] = { ...item, action: asAction };
          } else if (winner !== other.action) {
            kept[i] = { ...other, action: winner };
          }
          break;
        }
      }
      if (!overlaps) kept.push({ ...item, action: asAction });
    }
    out.push(...kept);
  }
  return out;
}

function extractValue(input: string | JsonObject, span: Span): string {
  if (typeof input === "string") {
    return input.slice(span.start, span.end);
  }
  const path = span.path ?? "";
  const leaf = getStringAtPointer(input, path);
  if (leaf === null) return "";
  return leaf.slice(span.start, span.end);
}

function replaceInString(text: string, start: number, end: number, replacement: string): string {
  return text.slice(0, start) + replacement + text.slice(end);
}

/**
 * Apply actions right-to-left. Throws {@link PolicyViolationError} on `block`.
 */
export async function applyActions<T extends string | JsonObject>(
  input: T,
  items: ApplyItem[],
  ctx: ApplyContext,
): Promise<{ output: T; decisions: Decision[] }> {
  const collapsed = collapseOverlaps(items);

  const blocks = collapsed.filter((i) => i.action === "block");
  if (blocks.length > 0) {
    const decisions = blocks.map((b) => ({ ...b.decision, action: "block" as const }));
    const first = decisions[0]!;
    throw new PolicyViolationError(
      `policy blocked entity "${first.entity}" via rule "${first.rule}"`,
      decisions,
    );
  }

  // review should have been rejected at validate time; treat as block-level failure if seen
  const reviews = collapsed.filter((i) => i.action === "review");
  if (reviews.length > 0) {
    throw new PolicyViolationError(
      `policy review is not implemented (rule "${reviews[0]!.decision.rule}")`,
      reviews.map((r) => r.decision),
    );
  }

  const workflowKey = await deriveWorkflowKey(ctx.masterKey, ctx.workflowId);
  let output: string | JsonObject = typeof input === "string" ? input : cloneJson(input);

  // Group by path for object leaves; apply right-to-left within each leaf.
  const byPath = new Map<string, CollapsedItem[]>();
  for (const item of collapsed) {
    const path = item.span.path ?? "";
    const list = byPath.get(path) ?? [];
    list.push(item);
    byPath.set(path, list);
  }

  const decisions: Decision[] = [];

  for (const [path, group] of byPath) {
    group.sort((a, b) => b.span.start - a.span.start);

    let leaf: string;
    if (typeof output === "string") {
      leaf = output;
    } else {
      leaf = getStringAtPointer(output, path) ?? "";
    }

    for (const item of group) {
      const action = item.action;
      const value = item.value || extractValue(input, item.span);
      let replacement = value;

      if (action === "mask") {
        replacement = maskLabel(item.span.entity);
      } else if (action === "tokenize") {
        const normalized = normalizeValue(item.span.entity, value);
        const tokenId = await deriveTokenId(workflowKey, item.span.entity, normalized);
        const token = formatToken(item.span.entity, tokenId, item.format, value);
        await ctx.vault.put({
          workflowId: ctx.workflowId,
          token,
          entity: item.span.entity,
          value,
        });
        replacement = token;
      } else if (action === "allow" || action === "detokenize") {
        replacement = value;
      }

      leaf = replaceInString(leaf, item.span.start, item.span.end, replacement);
      decisions.push(item.decision);
    }

    if (typeof output === "string") {
      output = leaf;
    } else {
      setStringAtPointer(output, path, leaf);
    }
  }

  // Preserve original decision order (by span start) for audit stability.
  decisions.sort((a, b) => a.span.start - b.span.start || a.span.path.localeCompare(b.span.path));

  return { output: output as T, decisions };
}
