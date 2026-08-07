"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Shell } from "@/components/shell";
import { getStoredApiKey, setStoredApiKey } from "@/lib/client-api";

export default function HomePage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapKey, setBootstrapKey] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredApiKey();
    if (existing !== null) {
      router.replace("/policy");
    }
  }, [router]);

  async function onEnter(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const key = apiKey.trim();
    if (!key.startsWith("tr_live_")) {
      setError("API keys start with tr_live_");
      return;
    }
    const res = await fetch("/api/v1/policy", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      setError("Could not authenticate that key against this plane.");
      return;
    }
    setStoredApiKey(key);
    router.push("/policy");
  }

  async function onBootstrap() {
    setBootstrapping(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/bootstrap", { method: "POST" });
      const data = (await res.json()) as { apiKey?: string; error?: string };
      if (!res.ok || data.apiKey === undefined) {
        setError(data.error ?? "Bootstrap failed");
        return;
      }
      setBootstrapKey(data.apiKey);
      setApiKey(data.apiKey);
      setStoredApiKey(data.apiKey);
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <Shell>
      <h1>Policy plane</h1>
      <p className="lede">
        Publish versioned policies and aggregate audit events from agents using{" "}
        <span className="mono">@tailrace/cloud</span>. Raw detected values never leave the host -
        only content hashes reach this plane.
      </p>

      <div className="stack" style={{ maxWidth: 520 }}>
        <form className="panel stack" onSubmit={onEnter}>
          <label>
            Project API key
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tr_live_…"
            />
          </label>
          <div className="row">
            <button type="submit">Open dashboard</button>
            <button type="button" className="secondary" onClick={() => void onBootstrap()} disabled={bootstrapping}>
              {bootstrapping ? "Creating…" : "Create demo project"}
            </button>
          </div>
          {error !== null ? <p className="error">{error}</p> : null}
          {bootstrapKey !== null ? (
            <div>
              <p className="muted">Demo API key (stored in this browser):</p>
              <div className="key-box">{bootstrapKey}</div>
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                <button type="button" className="secondary" onClick={() => router.push("/policy")}>
                  Continue to policy
                </button>
              </p>
            </div>
          ) : null}
        </form>
      </div>
    </Shell>
  );
}
