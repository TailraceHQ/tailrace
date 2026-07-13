import Link from "next/link";
import { FlowDemo } from "@/components/flow-demo";

export function HowItWorks() {
  return (
    <section className="home-section py-16 md:py-24">
      <div className="home-section-inner">
        <div className="mb-8 max-w-2xl">
          <h2 className="home-display text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
            Input → detect → resolve → apply.
          </h2>
          <p className="mt-3 text-fd-muted-foreground">
            Sensitive values are found in-process, policy decides the action, and audit records the
            decision - never the raw value.{" "}
            <Link
              href="/docs/concepts/boundaries"
              className="font-medium text-[color:var(--home-accent)] underline-offset-4 hover:underline"
            >
              Boundaries
            </Link>
          </p>
        </div>
        <FlowDemo />
      </div>
    </section>
  );
}
