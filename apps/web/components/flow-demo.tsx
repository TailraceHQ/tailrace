"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    id: "input",
    label: "Input",
    detail: "Agent prompt crosses the model boundary",
    code: `// User message → model boundary (out)
const prompt = \`
  Email billing@${"example.com"}
  Key sk_test_…FAKE
\`;`,
    highlight: null,
  },
  {
    id: "detect",
    label: "Detect",
    detail: "Tier 0 recognizers find spans in-process",
    code: `// Spans (no raw values in audit)
[
  { entity: "email",   path: "prompt", start: 16, end: 33 },
  { entity: "api_key", path: "prompt", start: 42, end: 68 },
]`,
    highlight: "detect",
  },
  {
    id: "resolve",
    label: "Policy resolve",
    detail: "boundary × identity × entity → action",
    code: `// Default policy
email   → tokenize  (entities.email)
api_key → block     (entities.api_key)`,
    highlight: "resolve",
  },
  {
    id: "apply",
    label: "Apply",
    detail: "block throws · tokenize writes vault",
    code: `// Before provider call (transformParams)
throw PolicyViolationError("api_key")
// If only email: "<EMAIL_a3f2k9qx>"`,
    highlight: "apply",
  },
  {
    id: "audit",
    label: "Audit",
    detail: "Every decision: rule, entity, contentHash",
    code: `{
  "action": "block",
  "entity": "api_key",
  "rule": "entities.api_key",
  "contentHash": "sha256:…"
}`,
    highlight: "audit",
  },
  {
    id: "restore",
    label: "Restore at egress",
    detail: "Detokenize only at trusted sinks",
    code: `// Route handler — egress boundary
await tailrace.restore(text, {
  boundary: { kind: "egress", sink: "ui" },
});
// UI sees billing@example.com`,
    highlight: "restore",
  },
] as const;

const PIPELINE = ["input", "detect", "resolve", "apply", "audit"] as const;

export function FlowDemo() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [paused]);

  const current = STEPS[step]!;
  const isRestore = current.id === "restore";

  return (
    <div className="not-prose my-8 overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-card-foreground shadow-sm">
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-fd-muted-foreground">
            Live pipeline · {current.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="rounded-md px-2 py-1 text-xs text-fd-muted-foreground transition hover:bg-fd-accent hover:text-fd-accent-foreground"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Agent panel */}
        <div className="border-b border-fd-border p-4 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-fd-muted-foreground">
            <span className="rounded bg-fd-muted px-1.5 py-0.5 font-mono text-[10px]">agent</span>
            support-bot · workflow sess-7f3a
          </div>
          <pre
            key={current.id}
            className="flow-demo-fade overflow-x-auto rounded-lg bg-fd-muted/50 p-3 text-[11px] leading-relaxed text-fd-foreground"
          >
            <code>{current.code}</code>
          </pre>
          <p className="mt-2 text-xs text-fd-muted-foreground">{current.detail}</p>
        </div>

        {/* Pipeline */}
        <div className="flex flex-col justify-center p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {PIPELINE.map((id, i) => {
              const meta = STEPS.find((s) => s.id === id)!;
              const active = current.id === id;
              const past = STEPS.findIndex((s) => s.id === current.id) > i;
              return (
                <div key={id} className="flex items-center gap-1.5">
                  <div
                    className={[
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition-all duration-500",
                      active
                        ? "border-fd-primary bg-fd-primary/10 text-fd-primary scale-105 shadow-sm"
                        : past
                          ? "border-fd-border bg-fd-muted/30 text-fd-muted-foreground"
                          : "border-fd-border/60 text-fd-muted-foreground/70",
                    ].join(" ")}
                  >
                    {meta.label}
                  </div>
                  {i < PIPELINE.length - 1 ? (
                    <span
                      className={[
                        "text-fd-muted-foreground transition-opacity duration-500",
                        past || active ? "opacity-100" : "opacity-30",
                      ].join(" ")}
                    >
                      →
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div
            className={[
              "mt-4 flex items-start gap-2 rounded-lg border border-dashed p-3 transition-all duration-500",
              isRestore
                ? "border-violet-500/50 bg-violet-500/5"
                : "border-fd-border/50 bg-transparent opacity-50",
            ].join(" ")}
          >
            <span className="mt-0.5 text-fd-muted-foreground">↳</span>
            <div>
              <div
                className={[
                  "text-[11px] font-medium transition-colors duration-500",
                  isRestore ? "text-violet-600 dark:text-violet-400" : "text-fd-muted-foreground",
                ].join(" ")}
              >
                Restore at egress only
              </div>
              <div className="text-[10px] text-fd-muted-foreground">
                Never at model · tool · MCP · telemetry boundaries
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-1">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to ${s.label}`}
                onClick={() => setStep(i)}
                className={[
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  i === step ? "bg-fd-primary" : "bg-fd-muted hover:bg-fd-muted-foreground/30",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-fd-border bg-fd-muted/20 px-4 py-2 text-[10px] text-fd-muted-foreground">
        In-process only · zero network on the hot path · same email + workflow → same token
      </div>
    </div>
  );
}
