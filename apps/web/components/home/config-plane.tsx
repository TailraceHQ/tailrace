"use client";

import { useState, type ReactNode } from "react";

const CLI = "npx @tailrace/cli init";

const CONFIG_LINES: { text: string; pulse?: boolean; delay: number }[] = [
  { text: 'import { createTailrace } from "@tailrace/core";', delay: 0 },
  { text: '// import { definePolicy } from "@tailrace/core";', delay: 40 },
  { text: "", delay: 80 },
  { text: "// Zero-config: secrets → block, common PII → tokenize.", delay: 120 },
  {
    text: '// Customize with definePolicy({ entities: { email: "tokenize", api_key: "block" } })',
    pulse: true,
    delay: 160,
  },
  { text: "// and pass { policy } to createTailrace.", delay: 200 },
  { text: "// Policy JSON Schema: https://tailrace.dev/schema/policy.v1.json", delay: 240 },
  { text: "export const tailrace = createTailrace();", delay: 280 },
];

function highlightLine(text: string): ReactNode {
  if (text.length === 0) return "\u00a0";
  if (text.trimStart().startsWith("//")) {
    return <span className="flow-tok-comment">{text}</span>;
  }

  const parts: ReactNode[] = [];
  let rest = text;
  let key = 0;

  const pushPlain = (s: string) => {
    if (!s) return;
    parts.push(
      <span key={key++} className="flow-tok-plain">
        {s}
      </span>,
    );
  };

  const keywordRe = /\b(import|from|export|const)\b/g;
  const stringRe = /"[^"]*"/g;
  const tokens: { start: number; end: number; kind: "keyword" | "string" }[] = [];

  for (const match of text.matchAll(keywordRe)) {
    if (match.index !== undefined) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "keyword" });
    }
  }
  for (const match of text.matchAll(stringRe)) {
    if (match.index !== undefined) {
      tokens.push({ start: match.index, end: match.index + match[0].length, kind: "string" });
    }
  }
  tokens.sort((a, b) => a.start - b.start);

  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) continue;
    pushPlain(rest.slice(cursor, token.start));
    parts.push(
      <span
        key={key++}
        className={token.kind === "keyword" ? "flow-tok-keyword" : "flow-tok-string"}
      >
        {rest.slice(token.start, token.end)}
      </span>,
    );
    cursor = token.end;
  }
  pushPlain(rest.slice(cursor));
  return parts;
}

export function ConfigPlane() {
  const [copied, setCopied] = useState(false);

  const copyCli = async () => {
    try {
      await navigator.clipboard.writeText(CLI);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="home-config-plane w-full">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md border border-fd-border bg-[color-mix(in_oklab,var(--home-slate)_92%,black)] px-3 py-2 font-mono text-[13px] text-[#e6edf3]">
          <span className="text-[color:var(--home-accent)]">$</span> {CLI}
        </code>
        <button
          type="button"
          onClick={() => void copyCli()}
          className="rounded-md border border-fd-border bg-fd-background px-3 py-2 text-xs font-medium text-fd-foreground transition hover:border-[color:var(--home-accent)] hover:text-[color:var(--home-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--home-accent)]/40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="overflow-hidden rounded-none border-y border-fd-border bg-[color-mix(in_oklab,var(--home-slate)_94%,black)] shadow-none md:rounded-xl md:border">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="font-mono text-[11px] text-[#8b949e]">tailrace.config.ts</span>
          <span className="text-[10px] uppercase tracking-wide text-[#8b949e]">TypeScript</span>
        </div>
        <pre className="flow-demo-code-window overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed">
          <code>
            {CONFIG_LINES.map((line, i) => (
              <div
                key={i}
                className={`home-config-line${line.pulse ? " policy-pulse" : ""}`}
                style={{ animationDelay: `${line.delay}ms` }}
              >
                <span className="mr-4 inline-block w-5 select-none text-right text-[#484f58]">
                  {i + 1}
                </span>
                {highlightLine(line.text)}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
