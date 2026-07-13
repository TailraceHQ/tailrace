"use client";

import { useEffect, useId, useState } from "react";

/**
 * Renders a Mermaid diagram from its text source.
 *
 * `mermaid` is a heavy dependency, so it is dynamically imported - it only
 * loads on pages that actually contain a diagram. The renderer re-runs when the
 * site theme flips (Fumadocs toggles `class="dark"` on `<html>`) so diagrams
 * match light and dark mode.
 *
 * @example
 * <Mermaid chart={`flowchart LR\n  A --> B`} />
 */
export function Mermaid({ chart }: { chart: string }) {
  // useId returns colons that Mermaid's DOM ids reject; strip to alphanumerics.
  const id = "mmd-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import("mermaid");
      const isDark = document.documentElement.classList.contains("dark");
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "inherit",
      });
      try {
        const rendered = await mermaid.render(id, chart);
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        // Leave prior render in place on a transient parse error.
      }
    }

    void render();

    const observer = new MutationObserver(() => void render());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [chart, id]);

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // Diagram markup is authored in-repo and Mermaid runs with securityLevel: "strict".
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
    />
  );
}
