"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/shell";
import { apiFetch, getStoredApiKey } from "@/lib/client-api";

export default function PolicyPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [version, setVersion] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (getStoredApiKey() === null) {
      router.replace("/");
      return;
    }
    setError(null);
    const res = await apiFetch("/api/v1/policy");
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    if (!res.ok) {
      setError(`Load failed (${String(res.status)})`);
      return;
    }
    const data = (await res.json()) as {
      version: number;
      document: unknown;
      publishedAt: string;
    };
    setVersion(data.version);
    setPublishedAt(data.publishedAt);
    setText(JSON.stringify(data.document, null, 2));
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPublish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      let document: unknown;
      try {
        document = JSON.parse(text) as unknown;
      } catch {
        setError("Document must be valid JSON");
        return;
      }
      const res = await apiFetch("/api/v1/policy", {
        method: "POST",
        body: JSON.stringify({ document }),
      });
      const data = (await res.json()) as {
        version?: number;
        publishedAt?: string;
        document?: unknown;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? `Publish failed (${String(res.status)})`);
        return;
      }
      setVersion(data.version ?? null);
      setPublishedAt(data.publishedAt ?? null);
      if (data.document !== undefined) {
        setText(JSON.stringify(data.document, null, 2));
      }
      setStatus(`Published version ${String(data.version)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1>Policy</h1>
      <p className="lede">
        Edit a <span className="mono">PolicyDocument</span>. Publish runs the same{" "}
        <span className="mono">definePolicy</span> validation as core - invalid documents are
        rejected.
      </p>

      <form className="panel stack" onSubmit={(e) => void onPublish(e)}>
        <div className="row">
          <span className="muted">
            {version !== null ? (
              <>
                Version <span className="mono">{version}</span>
                {publishedAt !== null ? <> · {publishedAt}</> : null}
              </>
            ) : (
              "Loading…"
            )}
          </span>
          <button type="button" className="secondary" onClick={() => void load()}>
            Reload
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          aria-label="Policy JSON"
        />
        {error !== null ? <p className="error">{error}</p> : null}
        {status !== null ? <p className="ok">{status}</p> : null}
      </form>
    </Shell>
  );
}
