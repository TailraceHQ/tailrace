"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Shell } from "@/components/shell";
import { apiFetch, getStoredApiKey } from "@/lib/client-api";

interface AuditRow {
  id: string;
  type: string;
  workflowId: string;
  timestamp: number;
  decisions: Array<{
    action: string;
    entity: string;
    boundary: { kind: string };
    identity: { agent: string };
    rule: string;
    contentHash: string;
  }>;
}

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState("");
  const [boundaryKind, setBoundaryKind] = useState("");
  const [identity, setIdentity] = useState("");
  const [rule, setRule] = useState("");
  const [contentHash, setContentHash] = useState("");

  const load = useCallback(async () => {
    if (getStoredApiKey() === null) {
      router.replace("/");
      return;
    }
    const params = new URLSearchParams();
    if (entity.trim()) params.set("entity", entity.trim());
    if (boundaryKind.trim()) params.set("boundaryKind", boundaryKind.trim());
    if (identity.trim()) params.set("identity", identity.trim());
    if (rule.trim()) params.set("rule", rule.trim());
    if (contentHash.trim()) params.set("contentHash", contentHash.trim());
    params.set("limit", "100");

    const res = await apiFetch(`/api/v1/audit?${params.toString()}`);
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    if (!res.ok) {
      setError(`Load failed (${String(res.status)})`);
      return;
    }
    const data = (await res.json()) as { events: AuditRow[] };
    setEvents(data.events);
    setError(null);
  }, [boundaryKind, contentHash, entity, identity, router, rule]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Shell>
      <h1>Audit</h1>
      <p className="lede">
        Events are keyed by <span className="mono">contentHash</span> for correlation. This UI
        cannot render raw values - they were never sent.
      </p>

      <div className="panel">
        <div className="filters">
          <label>
            Entity
            <input value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="email" />
          </label>
          <label>
            Boundary
            <input
              value={boundaryKind}
              onChange={(e) => setBoundaryKind(e.target.value)}
              placeholder="model"
            />
          </label>
          <label>
            Identity
            <input
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="support-agent"
            />
          </label>
          <label>
            Rule contains
            <input value={rule} onChange={(e) => setRule(e.target.value)} placeholder="entities." />
          </label>
          <label>
            contentHash
            <input
              value={contentHash}
              onChange={(e) => setContentHash(e.target.value)}
              placeholder="sha256…"
            />
          </label>
        </div>
        <div className="row" style={{ marginBottom: "1rem" }}>
          <button type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {error !== null ? <p className="error">{error}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Workflow</th>
                <th>Decisions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No events yet. Point <span className="mono">remoteAuditSink</span> at this
                    plane.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="mono">{new Date(ev.timestamp).toISOString()}</td>
                    <td>
                      <span className="pill">{ev.type}</span>
                    </td>
                    <td className="mono">{ev.workflowId}</td>
                    <td>
                      {ev.decisions.map((d, i) => (
                        <div key={`${ev.id}-${String(i)}`} style={{ marginBottom: "0.35rem" }}>
                          <span className="pill">{d.action}</span>{" "}
                          <span className="mono">{d.entity}</span> · {d.boundary.kind} ·{" "}
                          {d.identity.agent}
                          <div className="muted mono" style={{ fontSize: "0.75rem" }}>
                            {d.rule} · {d.contentHash.slice(0, 12)}…
                          </div>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
