"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Shell } from "@/components/shell";
import { clearStoredApiKey, getStoredApiKey } from "@/lib/client-api";

export default function SettingsPage() {
  const router = useRouter();
  const [prefix, setPrefix] = useState<string | null>(null);
  const [snippet, setSnippet] = useState("");

  useEffect(() => {
    const key = getStoredApiKey();
    if (key === null) {
      router.replace("/");
      return;
    }
    setPrefix(key.slice(0, 12));
    const origin = window.location.origin;
    setSnippet(`import { createTailrace } from "@tailrace/core";
import { remoteAuditSink, remotePolicy } from "@tailrace/cloud";

const apiKey = process.env.TAILRACE_API_KEY!;

export const tailrace = createTailrace({
  policy: remotePolicy("${origin}/api/v1/policy", { apiKey }),
  audit: {
    sinks: [remoteAuditSink("${origin}/api/v1/audit", { apiKey })],
  },
});`);
  }, [router]);

  return (
    <Shell>
      <h1>Settings</h1>
      <p className="lede">
        One API key per project environment. No RBAC in this MVP - treat the key as a shared secret.
      </p>

      <div className="stack">
        <div className="panel stack">
          <p className="muted">
            Active key prefix: <span className="mono">{prefix ?? "…"}…</span>
          </p>
          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                clearStoredApiKey();
                router.push("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="panel stack">
          <div className="editor-chrome">
            <span className="filename">tailrace.config.ts</span>
            <span className="lang">TypeScript</span>
          </div>
          <h2>Agent wiring</h2>
          <p className="muted">
            Policy is pulled at init / on poll. Audit ships async. Kill this service and the host
            keeps last-known-good policy.
          </p>
          <pre className="key-box" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {snippet || "…"}
          </pre>
        </div>
      </div>
    </Shell>
  );
}
