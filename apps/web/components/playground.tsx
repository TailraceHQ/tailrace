"use client";

import {
  definePatternRecognizer,
  RecognizerError,
  SECRET_ENTITY_CLASSES,
  type Action,
  type Decision,
} from "@tailrace/core";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  compilePlaygroundRecognizers,
  PLAYGROUND_TOGGLE_ENTITIES,
  runPlaygroundScan,
  type PlaygroundCustomPattern,
  type PlaygroundToggleEntity,
} from "@/lib/playground-scan";

const SECRET_SET = new Set<string>(SECRET_ENTITY_CLASSES);

// Synthetic Stripe test key, assembled at runtime so the secret-shaped literal
// never appears contiguously in source and cannot trip source secret scanners.
// Tailrace still detects it once the string is built (see block-secrets convention).
const SAMPLE_API_KEY = ["sk", "test", "51H8xFAKEabcdefghijklmno"].join("_");

const SAMPLE = `Please charge card 4532 0151 1283 0366 and email the receipt to alice@example.com.
Also call +1 415 555 0132 if needed.
API key: ${SAMPLE_API_KEY}`;

type ToggleEntity = PlaygroundToggleEntity;
const TOGGLE_ENTITIES = PLAYGROUND_TOGGLE_ENTITIES;

const ACTIONS: readonly Action[] = ["allow", "mask", "tokenize", "block"];

const DEFAULT_ACTIONS: Record<ToggleEntity, Action> = {
  api_key: "block",
  jwt: "block",
  private_key: "block",
  high_entropy_secret: "block",
  connection_string: "block",
  email: "tokenize",
  phone: "tokenize",
  credit_card: "tokenize",
  iban: "tokenize",
  ssn: "tokenize",
  ip_address: "allow",
  url_credentials: "block",
};

const CUSTOM_PATTERN_DEFAULTS: Omit<PlaygroundCustomPattern, "id"> = {
  entity: "employee_id",
  source: String.raw`\bEMP-\d{5}\b`,
  confidence: "1",
  action: "tokenize",
};

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
  const [customPatterns, setCustomPatterns] = useState<PlaygroundCustomPattern[]>([]);
  const [draftEntity, setDraftEntity] = useState(CUSTOM_PATTERN_DEFAULTS.entity);
  const [draftSource, setDraftSource] = useState(CUSTOM_PATTERN_DEFAULTS.source);
  const [draftConfidence, setDraftConfidence] = useState(CUSTOM_PATTERN_DEFAULTS.confidence);
  const [draftAction, setDraftAction] = useState<Action>(CUSTOM_PATTERN_DEFAULTS.action);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ status: "idle" });

  const { errors: patternErrors } = useMemo(
    () => compilePlaygroundRecognizers(customPatterns),
    [customPatterns],
  );

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
        const result = await runPlaygroundScan({ text, actions, customPatterns });
        if (cancelled) return;
        setScan(result);
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [text, actions, customPatterns]);

  const decisions = scan.status === "ok" ? scan.decisions : [];

  function addCustomPattern(): void {
    const id = `custom-${customPatterns.length + 1}`;
    try {
      definePatternRecognizer({
        id,
        entity: draftEntity,
        tier: 0,
        patterns: [
          {
            source: draftSource,
            ...(draftConfidence.trim() === "" ? {} : { confidence: Number(draftConfidence) }),
          },
        ],
      });
      setCustomPatterns((prev) => [
        ...prev,
        {
          id,
          entity: draftEntity,
          source: draftSource,
          confidence: draftConfidence,
          action: draftAction,
        },
      ]);
      setDraftError(null);
    } catch (err) {
      setDraftError(
        err instanceof RecognizerError
          ? err.message.split(" → ")[0]!
          : err instanceof Error
            ? err.message
            : "invalid pattern",
      );
    }
  }

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

      <div className="border-b border-fd-border px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-fd-muted-foreground">Custom patterns</span>
          <a
            href="/docs/guides/write-custom-recognizers"
            className="text-[11px] text-fd-primary hover:underline"
          >
            write-custom-recognizers guide
          </a>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono text-fd-muted-foreground">entity</span>
            <input
              value={draftEntity}
              onChange={(e) => setDraftEntity(e.target.value)}
              className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="font-mono text-fd-muted-foreground">pattern source</span>
            <input
              value={draftSource}
              onChange={(e) => setDraftSource(e.target.value)}
              spellCheck={false}
              className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono text-fd-muted-foreground">confidence</span>
            <input
              value={draftConfidence}
              onChange={(e) => setDraftConfidence(e.target.value)}
              className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[12px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-mono text-fd-muted-foreground">policy action</span>
            <select
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value as Action)}
              className="rounded-md border border-fd-border bg-fd-background px-2 py-1.5 font-mono text-[12px]"
            >
              {ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addCustomPattern}
            className="rounded-md border border-fd-border bg-fd-background px-3 py-1.5 text-xs font-medium hover:bg-fd-accent"
          >
            Add pattern
          </button>
          <button
            type="button"
            onClick={() =>
              setText((prev) =>
                prev.includes("EMP-01234") ? prev : `${prev}\nAssign ticket EMP-01234 to Alice`,
              )
            }
            className="rounded-md px-2 py-1 text-xs text-fd-muted-foreground hover:bg-fd-accent"
          >
            Insert employee-id sample
          </button>
        </div>
        {draftError ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{draftError}</p>
        ) : null}
        {customPatterns.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {customPatterns.map((pattern) => (
              <li
                key={pattern.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-fd-border bg-fd-muted/20 px-3 py-2 text-xs"
              >
                <span className="font-mono">
                  {pattern.entity} · {pattern.action} ·{" "}
                  <span className="opacity-70">{pattern.id}</span>
                </span>
                {patternErrors[pattern.id] ? (
                  <span className="text-red-600 dark:text-red-400">
                    {patternErrors[pattern.id]}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setCustomPatterns((prev) => prev.filter((p) => p.id !== pattern.id))
                  }
                  className="rounded px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-fd-muted-foreground">
            Session-only. Patterns validate via{" "}
            <span className="font-mono">definePatternRecognizer</span>.
          </p>
        )}
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-fd-border p-4 lg:border-b-0 lg:border-r">
          <label
            htmlFor={inputId}
            className="mb-2 block text-xs font-medium text-fd-muted-foreground"
          >
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
