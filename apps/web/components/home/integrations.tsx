import Link from "next/link";

const INTEGRATIONS = [
  {
    name: "AI SDK",
    href: "/docs/guides/ship-an-agent-on-vercel",
    blurb: "Ship a governed agent",
  },
  {
    name: "Claude Code",
    href: "/docs/integrations/claude-code",
    blurb: "Hooks that block secrets in tools",
  },
  {
    name: "MCP",
    href: "/docs/integrations/mcp",
    blurb: "Transport wrap + JSON-RPC blocks",
  },
  {
    name: "Hono",
    href: "/docs/integrations/hono",
    blurb: "OpenAI-compatible gateway middleware",
  },
  {
    name: "Next.js",
    href: "/docs/integrations/nextjs",
    blurb: "Route handlers and AI SDK demos",
  },
] as const;

export function Integrations() {
  return (
    <section className="home-section py-16 md:py-24">
      <div className="home-section-inner">
        <h2 className="home-display mb-3 max-w-2xl text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
          Drop in at the boundary you already use.
        </h2>
        <p className="mb-10 max-w-xl text-fd-muted-foreground">
          Adapters construct the boundary and call check / restore - they contain no policy logic of
          their own.
        </p>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                className="block rounded-lg border border-fd-border bg-fd-card/60 px-4 py-4 transition hover:border-[color:var(--home-accent)] hover:bg-fd-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--home-accent)]/40"
              >
                <span className="home-display text-base font-semibold text-fd-foreground">
                  {item.name}
                </span>
                <span className="mt-1 block text-sm text-fd-muted-foreground">{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
