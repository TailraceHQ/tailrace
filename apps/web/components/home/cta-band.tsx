"use client";

import Link from "next/link";
import { useState } from "react";

const CLI = "npx @tailrace/cli init";

export function CtaBand() {
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
    <section className="home-section py-16 md:py-24">
      <div className="home-section-inner">
        <h2 className="home-display mb-6 text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
          Govern the next boundary.
        </h2>

        <div className="mb-8 flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-fd-border bg-fd-card px-3 py-2 font-mono text-[13px] text-fd-foreground">
            <span className="text-[color:var(--home-accent)]">$</span> {CLI}
          </code>
          <button
            type="button"
            onClick={() => void copyCli()}
            className="rounded-md border border-fd-border px-3 py-2 text-xs font-medium text-fd-foreground transition hover:border-[color:var(--home-accent)] hover:text-[color:var(--home-accent)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <Link
            href="/docs/get-started/quickstart"
            className="inline-flex items-center rounded-md bg-[color:var(--home-accent)] px-4 py-2 text-sm font-medium text-[color:var(--home-accent-fg)] transition hover:brightness-110"
          >
            Get started
          </Link>
        </div>

        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-fd-border pt-6 text-sm text-fd-muted-foreground">
          <Link href="/docs" className="hover:text-fd-foreground">
            Docs
          </Link>
          <Link href="/docs/playground" className="hover:text-fd-foreground">
            Playground
          </Link>
          <a
            href="https://github.com/TailraceHQ/tailrace"
            className="hover:text-fd-foreground"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <span>MIT</span>
        </footer>
      </div>
    </section>
  );
}
