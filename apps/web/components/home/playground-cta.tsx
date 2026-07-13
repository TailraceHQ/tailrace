import Link from "next/link";

export function PlaygroundCta() {
  return (
    <section className="home-section border-y border-fd-border/70 py-16 md:py-20">
      <div className="home-section-inner flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 className="home-display text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
            Try Tier 0 in your browser.
          </h2>
          <p className="mt-3 text-fd-muted-foreground">
            Paste text, see spans, toggle policy actions. Scanning stays client-side after load -
            nothing you paste is uploaded.
          </p>
        </div>
        <Link
          href="/docs/playground"
          className="inline-flex shrink-0 items-center rounded-md bg-[color:var(--home-accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--home-accent-fg)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--home-accent)]/40"
        >
          Open playground
        </Link>
      </div>
    </section>
  );
}
