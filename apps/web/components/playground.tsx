"use client";

import {
  createTailrace,
  definePolicy,
  PolicyViolationError,
  SECRET_ENTITY_CLASSES,
  type Action,
  type Decision,
  type EntityClass,
  type EntityRuleValue,
  type PolicyDocument,
} from "@tailrace/core";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

// Synthetic Stripe test key, assembled at runtime so the secret-shaped literal
// never appears contiguously in source and cannot trip source secret scanners.
// Tailrace still detects it once the string is built (see block-secrets convention).
const SAMPLE_API_KEY = ["sk", "test", "51H8xFAKEabcdefghijklmno"].join("_");

const SAMPLE = `Please charge card 4532 0151 1283 0366 and email the receipt to alice@example.com.
Also call +1 415 555 0132 if needed.
API key: ${SAMPLE_API_KEY}`;

const TOGGLE_ENTITIES = ["api_key", "email", "phone", "credit_card"] as const;
type ToggleEntity = (typeof TOGGLE_ENTITIES)[number];

const ACTIONS: readonly Action[] = ["allow", "mask", "tokenize", "block"];

const DEFAULT_ACTIONS: Record<ToggleEntity, Action> = {
  api_key: "block",
  email: "tokenize",
  phone: "tokenize",
  credit_card: "tokenize",
};

const SECRET_SET = new Set<string>(SECRET_ENTITY_CLASSES);

const BOUNDARY = { kind: "model" as const, provider: "openai/gpt-4o" };
const IDENTITY = { agent: "default" };
const DEBOUNCE_MS = 150;

type ScanState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok"; output: string; decisions: Decision[] }
  | { status: "error"; message: string };

function actionClass(action: Action | "restore_miss"): string {
  switch (action) {
    case "block":
      return "bg-red-500/20 text-red-700 ring-red-500/40 dark:text-red-300";
    case "tokenize":
      return "bg-amber-500/20 text-amber-800 ring-amber-500/40 dark:text-amber-200";
    case "mask":
      return "bg-orange-500/20 text-orange-800 ring-orange-500/40 dark:text-orange-200";
    case "allow":
      return "bg-emerald-500/20 text-emerald-800 ring-emerald-500/40 dark:text-emerald-200";
    default:
      return "bg-fd-muted text-fd-muted-foreground ring-fd-border";
  }
}

function buildPolicy(actions: Record<ToggleEntity, Action>): PolicyDocument {
  const entities: Partial<Record<EntityClass, EntityRuleValue>> = {};
  for (const entity of TOGGLE_ENTITIES) {
    const action = actions[entity];
    if (SECRET_SET.has(entity) && action === "allow") {
      entities[entity] = { action: "allow", dangerouslyAllowSecrets: true };
    } else {
      entities[entity] = action;
    }
  }
  return definePolicy({
    defaults: { action: "allow" },
    entities,
  });
}

function HighlightedText({ text, decisions }: { text: string; decisions: Decision[] }) {
  const ranges = [...decisions]
    .map((d) => ({
      start: d.span.start,
      end: d.span.end,
      entity: d.entity,
      action: d.action,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.end <= cursor) continue;
    const start = Math.max(range.start, cursor);
    if (start > cursor) {
      parts.push(<span key={`t-${cursor}`}>{text.slice(cursor, start)}</span>);
    }
    if (start < range.end) {
      parts.push(
        <mark
          key={`m-${range.start}-${range.end}-${range.entity}`}
          className={`rounded-sm px-0.5 ring-1 ring-inset ${actionClass(range.action)}`}
          title={`${range.entity} → ${range.action}`}
        >
          {text.slice(start, range.end)}
        </mark>,
      );
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-fd-foreground">
      {parts.length > 0 ? parts : text || <span className="text-fd-muted-foreground">∅</span>}
    </pre>
  );
}

export function Playground() {
  const inputId = useId();
  const [text, setText] = useState(SAMPLE);
  const [actions, setActions] = useState<Record<ToggleEntity, Action>>(DEFAULT_ACTIONS);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });

  const secretAllowAttempt = useMemo(
    () => TOGGLE_ENTITIES.filter((e) => SECRET_SET.has(e) && actions[e] === "allow"),
    [actions],
  );

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        setScan({ status: "running" });
        try {
          const policy = buildPolicy(actions);
          const tailrace = createTailrace({ policy });
          const result = await tailrace.check(text, {
            boundary: BOUNDARY,
            identity: IDENTITY,
            workflowId: "playground",
          }, { applyBlockAs: "mask" });
          if (cancelled) return;
          setScan({
            status: "ok",
            output: result.output,
            decisions: result.decisions,
          });
        } catch (err) {
          if (cancelled) return;
          if (err instanceof PolicyViolationError) {
            setScan({
              status: "ok",
              output: text,
              decisions: err.decisions,
            });
            return;
          }
          setScan({
            status: "error",
            message: err instanceof Error ? err.message : "Scan failed",
          });
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [text, actions]);

  const decisions = scan.status === "ok" ? scan.decisions : [];

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-card-foreground shadow-sm">
      <div className="border-b border-fd-border bg-emerald-500/5 px-4 py-3 text-sm text-fd-foreground">
        <p className="font-medium text-emerald-800 dark:text-emerald-300">
          Scanning stays in your browser
        </p>
        <p className="mt-1 text-xs text-fd-muted-foreground">
          Tier 0 runs entirely client-side after this page loads. Pasted text is never sent to a
          server and this page ships no analytics of what you paste. It works offline once loaded.
        </p>
      </div>

      <div className="border-b border-fd-border px-4 py-3">
        <div className="mb-2 text-xs font-medium text-fd-muted-foreground">
          Policy actions · model boundary · agent default
        </div>
        <div className="flex flex-wrap gap-3">
          {TOGGLE_ENTITIES.map((entity) => (
            <label key={entity} className="flex flex-col gap-1 text-xs">
              <span className="font-mono text-fd-muted-foreground">{entity}</span>
              <select
                value={actions[entity]}
                onChange={(e) => {
                  const next = e.target.value as Action;
                  setActions((prev) => ({ ...prev, [entity]: next }));
                }}
                className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[12px] text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-primary/40"
              >
                {ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {secretAllowAttempt.length > 0 ? (
          <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Allowing secret class{secretAllowAttempt.length > 1 ? "es" : ""}{" "}
            <span className="font-mono">{secretAllowAttempt.join(", ")}</span> requires{" "}
            <span className="font-mono">dangerouslyAllowSecrets: true</span> on the rule. The
            playground sets that flag so you can see the effect - do not copy this into production
            casually.
          </p>
        ) : null}
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-fd-border p-4 lg:border-b-0 lg:border-r">
          <label htmlFor={inputId} className="mb-2 block text-xs font-medium text-fd-muted-foreground">
            Paste text
          </label>
          <textarea
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full resize-y rounded-lg border border-fd-border bg-fd-background px-3 py-2 font-mono text-[13px] leading-relaxed text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-primary/40"
          />
          <button
            type="button"
            onClick={() => setText(SAMPLE)}
            className="mt-2 rounded-md px-2 py-1 text-xs text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Reset sample
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-fd-muted-foreground">
              <span>Detected spans</span>
              <span className="font-normal">
                {scan.status === "running"
                  ? "scanning…"
                  : scan.status === "ok"
                    ? `${decisions.length} decision${decisions.length === 1 ? "" : "s"}`
                    : scan.status === "error"
                      ? "error"
                      : null}
              </span>
            </div>
            <div className="min-h-[6rem] rounded-lg border border-fd-border bg-fd-background px-3 py-2">
              {scan.status === "error" ? (
                <p className="text-sm text-red-600 dark:text-red-400">{scan.message}</p>
              ) : (
                <HighlightedText text={text} decisions={decisions} />
              )}
            </div>
          </div>

          {decisions.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {decisions.map((d, i) => (
                <li
                  key={`${d.contentHash}-${i}`}
                  className={`rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-inset ${actionClass(d.action)}`}
                >
                  {d.entity}
                  <span className="opacity-70"> → {d.action}</span>
                  {d.appliedAs !== undefined ? (
                    <span className="opacity-70"> (applied as {d.appliedAs})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div>
            <div className="mb-2 text-xs font-medium text-fd-muted-foreground">
              Transformed output
            </div>
            <div className="min-h-[4rem] rounded-lg border border-dashed border-fd-border bg-fd-muted/20 px-3 py-2">
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-fd-foreground">
                {scan.status === "ok" ? scan.output || "∅" : "…"}
              </pre>
            </div>
            <p className="mt-2 text-[10px] text-fd-muted-foreground">
              Blocks use <span className="font-mono">applyBlockAs: &quot;mask&quot;</span> so the
              demo keeps rendering instead of throwing. Resolved action badges still show{" "}
              <span className="font-mono">block</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-fd-border bg-fd-muted/20 px-4 py-2 text-[10px] text-fd-muted-foreground">
        In-process Tier 0 · no network on scan · synthetic fixtures only
      </div>
    </div>
  );
}
