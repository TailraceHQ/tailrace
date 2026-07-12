"use client";

import { Fragment, useMemo, type ReactNode } from "react";

type CodeLang = "typescript" | "json";

const KEYWORDS = new Set([
  "const",
  "await",
  "throw",
  "new",
  "return",
  "async",
  "import",
  "from",
  "type",
  "interface",
  "kind",
]);

const TYPES = new Set(["PolicyViolationError"]);

interface FlowDemoCodeProps {
  code: string;
  lang?: CodeLang;
  filename?: string;
}

function highlightLine(line: string, lang: CodeLang): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const push = (text: string, className?: string) => {
    if (!text) return;
    nodes.push(
      className ? (
        <span key={key++} className={className}>
          {text}
        </span>
      ) : (
        <Fragment key={key++}>{text}</Fragment>
      ),
    );
  };

  if (lang === "json") {
    while (i < line.length) {
      if (/\s/.test(line[i]!)) {
        const ws = line.slice(i).match(/^\s+/)![0]!;
        push(ws);
        i += ws.length;
        continue;
      }
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length && line[j] !== '"') j++;
        push(line.slice(i, j + 1), "flow-tok-string");
        i = j + 1;
        continue;
      }
      push(line[i]!);
      i++;
    }
    return nodes;
  }

  while (i < line.length) {
    const rest = line.slice(i);

    if (rest.startsWith("//")) {
      push(rest, "flow-tok-comment");
      break;
    }

    if (/^\s+/.test(rest)) {
      const ws = rest.match(/^\s+/)![0]!;
      push(ws);
      i += ws.length;
      continue;
    }

    if (rest[0] === '"' || rest[0] === "'" || rest[0] === "`") {
      const q = rest[0];
      let j = 1;
      while (j < rest.length && rest[j] !== q) j++;
      push(rest.slice(0, j + 1), "flow-tok-string");
      i += j + 1;
      continue;
    }

    if (/^[a-zA-Z_$][\w$]*/.test(rest)) {
      const word = rest.match(/^[a-zA-Z_$][\w$]*/)![0]!;
      if (KEYWORDS.has(word)) push(word, "flow-tok-keyword");
      else if (TYPES.has(word)) push(word, "flow-tok-type");
      else if (/^[A-Z]/.test(word)) push(word, "flow-tok-type");
      else push(word, "flow-tok-plain");
      i += word.length;
      continue;
    }

    if (/^\d+/.test(rest)) {
      const num = rest.match(/^\d+/)![0]!;
      push(num, "flow-tok-number");
      i += num.length;
      continue;
    }

    if (/^[{}[\](),:;.]/.test(rest)) {
      push(rest[0]!, "flow-tok-punct");
      i++;
      continue;
    }

    if (rest.startsWith("→")) {
      push("→", "flow-tok-operator");
      i += 1;
      continue;
    }

    push(rest[0]!);
    i++;
  }

  return nodes;
}

export function FlowDemoCode({
  code,
  lang = "typescript",
  filename = "agent.ts",
}: FlowDemoCodeProps) {
  const lines = useMemo(() => code.split("\n"), [code]);

  return (
    <div className="flow-demo-code-window overflow-hidden rounded-lg border border-fd-border/80 bg-[#0d1117] dark:bg-[#0d1117]">
      <div className="flex items-center gap-3 border-b border-[#30363d] bg-[#161b22] px-3 py-2">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[10px] text-[#8b949e]">{filename}</span>
      </div>
      <pre className="flow-demo-fade m-0 overflow-x-auto p-0 text-[11px] leading-[1.55]">
        <code className="flow-demo-code block min-w-full">
          {lines.map((line, lineIndex) => (
            <div key={`${filename}-${lineIndex}`} className="flow-demo-line table-row">
              <span className="flow-demo-gutter table-cell select-none pr-3 pl-3 text-right text-[#484f58]">
                {lineIndex + 1}
              </span>
              <span className="table-cell pr-4 whitespace-pre">
                {line.length === 0 ? "\u00a0" : highlightLine(line, lang)}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function flowDemoFilename(stepId: string): { filename: string; lang: CodeLang } {
  switch (stepId) {
    case "detect":
      return { filename: "spans.json", lang: "json" };
    case "audit":
      return { filename: "audit.json", lang: "json" };
    case "resolve":
      return { filename: "policy.ts", lang: "typescript" };
    case "apply":
      return { filename: "transform.ts", lang: "typescript" };
    case "restore":
      return { filename: "route.ts", lang: "typescript" };
    default:
      return { filename: "prompt.ts", lang: "typescript" };
  }
}
