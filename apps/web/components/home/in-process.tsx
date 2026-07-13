export function InProcess() {
  const claims = [
    {
      title: "No network on the hot path",
      body: "Detection, policy, and vault run inside your process. No proxy, sidecar, or round-trip to apply a block.",
    },
    {
      title: "Node, Workers, and Edge",
      body: "@tailrace/core uses WebCrypto only - the same gate runs where your agent already runs.",
    },
    {
      title: "Policy is the product",
      body: "Detection engines are pluggable. Effort goes into resolution, tokenization, and audit at each boundary.",
    },
  ] as const;

  return (
    <section className="home-section border-y border-fd-border/70 py-16 md:py-24">
      <div className="home-section-inner">
        <h2 className="home-display mb-10 max-w-2xl text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
          In-process, not a proxy.
        </h2>

        <div className="grid gap-8 md:grid-cols-3">
          {claims.map((claim) => (
            <div key={claim.title} className="border-t border-[color:var(--home-accent)]/40 pt-4">
              <h3 className="home-display text-lg font-semibold text-fd-foreground">
                {claim.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{claim.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="mb-3 text-left text-xs text-fd-muted-foreground">
              Deployment model (factual contrast; full comparison page later)
            </caption>
            <thead>
              <tr className="border-b border-fd-border text-fd-muted-foreground">
                <th className="py-2 pr-4 font-medium"> </th>
                <th className="py-2 pr-4 font-medium text-fd-foreground">Tailrace</th>
                <th className="py-2 font-medium">Proxy / gateway</th>
              </tr>
            </thead>
            <tbody className="text-fd-muted-foreground">
              <tr className="border-b border-fd-border/70">
                <td className="py-3 pr-4 font-medium text-fd-foreground">Where it runs</td>
                <td className="py-3 pr-4">In your Node / Worker / Edge process</td>
                <td className="py-3">Separate hop in front of the model</td>
              </tr>
              <tr className="border-b border-fd-border/70">
                <td className="py-3 pr-4 font-medium text-fd-foreground">Hot-path network</td>
                <td className="py-3 pr-4">None for check / restore</td>
                <td className="py-3">Required to reach the gateway</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-fd-foreground">Policy ownership</td>
                <td className="py-3 pr-4">Code + config in your repo</td>
                <td className="py-3">Often a hosted control plane</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
