import type { AuditEvent } from "@tailrace/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { remoteAuditSink } from "./remote-audit-sink";

function sampleEvent(workflowId: string): AuditEvent {
  return {
    type: "check",
    workflowId,
    timestamp: Date.now(),
    decisions: [
      {
        action: "block",
        entity: "api_key",
        boundary: { kind: "model", provider: "openai/gpt-4o" },
        identity: { agent: "default" },
        rule: "entities.api_key",
        span: { path: "", start: 0, end: 8 },
        contentHash: "a".repeat(64),
      },
    ],
  };
}

describe("remoteAuditSink", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches events and POSTs them", async () => {
    vi.useFakeTimers();
    const bodies: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ accepted: 1 }), { status: 202 });
    });

    const sink = remoteAuditSink("https://plane.test/api/v1/audit", {
      apiKey: "tr_test_key",
      batchIntervalMs: 50,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    sink.emit(sampleEvent("wf-1"));
    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalled();
    expect(bodies[0]).toEqual({
      events: [expect.objectContaining({ workflowId: "wf-1" })],
    });
    const call = fetchImpl.mock.calls[0];
    expect(call?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tr_test_key" }),
      }),
    );
  });

  it("flushes immediately at maxBatchSize", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 202 }));

    const sink = remoteAuditSink("https://plane.test/api/v1/audit", {
      apiKey: "tr_test_key",
      maxBatchSize: 2,
      batchIntervalMs: 60_000,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    sink.emit(sampleEvent("a"));
    sink.emit(sampleEvent("b"));
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("drops on delivery failure and never throws", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });

    const sink = remoteAuditSink("https://plane.test/api/v1/audit", {
      apiKey: "tr_test_key",
      batchIntervalMs: 10,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    expect(() => sink.emit(sampleEvent("wf-drop"))).not.toThrow();
    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("never includes raw sensitive values in the wire payload", async () => {
    vi.useFakeTimers();
    let rawBody = "";
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      rawBody = String(init?.body);
      return new Response("{}", { status: 202 });
    });

    const sink = remoteAuditSink("https://plane.test/api/v1/audit", {
      apiKey: "tr_test_key",
      batchIntervalMs: 10,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    sink.emit(sampleEvent("wf-safe"));
    await vi.advanceTimersByTimeAsync(10);
    await Promise.resolve();
    await Promise.resolve();

    expect(rawBody).not.toMatch(/sk_test_|4242|alice@|555-?0100/i);
    expect(rawBody).toContain("contentHash");
  });
});
