"use client";

import { useState } from "react";

const MCP_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : "https://tailrace.dev") + "/mcp";

/**
 * Copy the docs MCP server URL (GitBook-style "Connect with MCP").
 */
export function CopyMcpUrlButton(): React.ReactElement {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(MCP_URL);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied MCP URL" : "Copy MCP URL"}
    </button>
  );
}
