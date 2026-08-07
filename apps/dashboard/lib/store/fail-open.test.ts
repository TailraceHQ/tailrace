/**
 * End-to-end: @tailrace/cloud against an in-process plane store via injected fetch.
 * Proves fail-open when the "service" is killed (scope acceptance criterion #4).
 */

import { remoteAuditSink, remotePolicy } from "@tailrace/cloud";
import { createTailrace, definePolicy } from "@tailrace/core";
import { describe, expect, it } from "vitest";

import { MemoryPlaneStore } from "./memory";

function storeFetch(store: MemoryPlaneStore, apiKey: string): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const env = await store.resolveEnvironmentByApiKey(apiKey);
    if (env === null) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }

    if (url.endsWith("/policy") && method === "GET") {
      const latest = await store.getLatestPolicy(env.id);
      if (latest === null) {
        return new Response(JSON.stringify({ error: "no_policy" }), { status: 404 });
      }
      return new Response(
        JSON.stringify({
          version: latest.version,
          document: latest.document,
          publishedAt: latest.publishedAt,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ETag: `"v${String(latest.version)}"` },
        },
      );
    }

    if (url.endsWith("/audit") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as {
        events: Parameters<MemoryPlaneStore["ingestAudit"]>[1];
      };
      const accepted = await store.ingestAudit(env.id, body.events);
      return new Response(JSON.stringify({ accepted }), { status: 202 });
    }

    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("cloud ↔ plane fail-open", () => {
  it("keeps enforcing last-known-good after the plane is killed", async () => {
    const store = new MemoryPlaneStore();
    const boot = await store.ensureBootstrap();
    await store.publishPolicy(
      boot.environment.id,
      definePolicy({ entities: { email: "mask" }, defaults: { action: "allow" } }),
    );

    let live = true;
    const fetchImpl: typeof fetch = async (input, init) => {
      if (!live) throw new Error("plane killed");
      return storeFetch(store, boot.apiKey)(input, init);
    };

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: boot.apiKey,
      fetch: fetchImpl,
    });

    const gate = createTailrace({
      policy: source,
      audit: {
        sinks: [
          remoteAuditSink("https://plane.test/api/v1/audit", {
            apiKey: boot.apiKey,
            batchIntervalMs: 1,
            fetch: fetchImpl,
          }),
        ],
      },
    });

    const first = await gate.check("contact alice@example.com", {
      boundary: { kind: "model", provider: "test" },
      identity: { agent: "default" },
      workflowId: "wf-e2e",
    });
    expect(String(first.output)).not.toContain("alice@example.com");

    live = false;

    const gate2 = createTailrace({ policy: source });
    const second = await gate2.check("contact bob@example.com", {
      boundary: { kind: "model", provider: "test" },
      identity: { agent: "default" },
      workflowId: "wf-e2e-2",
    });
    expect(String(second.output)).not.toContain("bob@example.com");
  });
});
