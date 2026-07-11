import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Tailrace</h1>
      <p className="mb-8 max-w-md text-fd-muted-foreground">
        In-process agent data governance: detect secrets and PII, tokenize, enforce policy at model,
        tool, and MCP boundaries.
      </p>
      <Link
        href="/docs"
        className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
      >
        Read the docs
      </Link>
    </div>
  );
}
