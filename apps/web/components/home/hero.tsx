import Link from "next/link";
import { Logo } from "@/components/logo";
import { ConfigPlane } from "@/components/home/config-plane";

export function HomeHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="home-section pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="home-section-inner">
          <div className="mb-8 flex flex-col gap-6 md:mb-12 md:max-w-2xl">
            <div className="flex items-center gap-3">
              <Logo size="lg" />
              <span className="home-display text-4xl font-semibold tracking-tight text-fd-foreground md:text-5xl">
                Tailrace
              </span>
            </div>

            <h1 className="home-display text-3xl font-semibold leading-[1.1] tracking-tight text-fd-foreground md:text-5xl">
              Govern agent data at the boundary.
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-fd-muted-foreground md:text-lg">
              Detect secrets and PII in-process. Block, tokenize, or restore - at model, tool, and
              MCP - with zero required config.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs/get-started/quickstart"
                className="inline-flex items-center rounded-md bg-[color:var(--home-accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--home-accent-fg)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--home-accent)]/40"
              >
                Get started
              </Link>
              <Link
                href="/docs/playground"
                className="inline-flex items-center rounded-md border border-fd-border bg-transparent px-4 py-2.5 text-sm font-medium text-fd-foreground transition hover:border-[color:var(--home-accent)] hover:text-[color:var(--home-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--home-accent)]/40"
              >
                Playground
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full border-t border-fd-border/60 bg-[color-mix(in_oklab,var(--home-slate)_6%,transparent)] dark:bg-[color-mix(in_oklab,white_3%,transparent)]">
        <div className="home-section py-8 md:py-10">
          <div className="home-section-inner">
            <ConfigPlane />
          </div>
        </div>
      </div>
    </section>
  );
}
