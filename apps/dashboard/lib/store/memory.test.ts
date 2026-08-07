import { definePolicy, type AuditEvent } from "@tailrace/core";
import { describe, expect, it } from "vitest";

import { generateApiKey } from "../api-key";
import { parseAuditBatch } from "../validate-audit";
import { MemoryPlaneStore } from "./memory";

function sampleEvent(): AuditEvent {
  return {
    type: "check",
    workflowId: "wf-1",
    timestamp: 1_700_000_000_000,
    decisions: [
      {
        action: "block",
        entity: "api_key",
        boundary: { kind: "model", provider: "test" },
        identity: { agent: "default" },
        rule: "entities.api_key",
        span: { path: "", start: 0, end: 10 },
        contentHash: "b".repeat(64),
      },
    ],
  };
}

describe("MemoryPlaneStore", () => {
  it("bootstraps org → project → environment with a versioned default policy", async () => {
    const store = new MemoryPlaneStore();
    const boot = await store.ensureBootstrap();
    expect(boot.created).toBe(true);
    expect(boot.apiKey.startsWith("tr_live_")).toBe(true);

    const env = await store.resolveEnvironmentByApiKey(boot.apiKey);
    expect(env?.id).toBe(boot.environment.id);

    const policy = await store.getLatestPolicy(boot.environment.id);
    expect(policy?.version).toBe(1);
  });

  it("publishes versioned policies and resolves by API key", async () => {
    const store = new MemoryPlaneStore();
    const boot = await store.ensureBootstrap();
    const doc = definePolicy({ entities: { email: "mask" }, defaults: { action: "allow" } });
    const published = await store.publishPolicy(boot.environment.id, doc);
    expect(published.version).toBe(2);

    const latest = await store.getLatestPolicy(boot.environment.id);
    expect(latest?.document.entities?.email).toBe("mask");
  });

  it("ingests and filters audit events by entity / contentHash", async () => {
    const store = new MemoryPlaneStore();
    const boot = await store.ensureBootstrap();
    await store.ingestAudit(boot.environment.id, [sampleEvent()]);

    const byEntity = await store.queryAudit(boot.environment.id, { entity: "api_key" });
    expect(byEntity).toHaveLength(1);

    const byHash = await store.queryAudit(boot.environment.id, { contentHash: "b".repeat(64) });
    expect(byHash).toHaveLength(1);

    const miss = await store.queryAudit(boot.environment.id, { entity: "email" });
    expect(miss).toHaveLength(0);
  });

  it("never stores a second copy of the raw API key on re-bootstrap in memory mode", async () => {
    const store = new MemoryPlaneStore();
    const a = await store.ensureBootstrap();
    const b = await store.ensureBootstrap();
    expect(b.created).toBe(false);
    expect(b.apiKey).toBe(a.apiKey);
  });
});

describe("parseAuditBatch", () => {
  it("accepts safe AuditEvent batches", () => {
    const events = parseAuditBatch({ events: [sampleEvent()] });
    expect(events).toHaveLength(1);
    expect(events[0]?.decisions[0]?.boundary).toEqual({ kind: "model", provider: "test" });
  });

  it("allowlists known fields and drops unknown keys (including nested)", () => {
    const events = parseAuditBatch({
      events: [
        {
          type: "check",
          workflowId: "wf-1",
          timestamp: 1,
          note: "should drop",
          decisions: [
            {
              action: "block",
              entity: "api_key",
              boundary: {
                kind: "model",
                provider: "test",
                note: "nested leak",
                meta: { comment: "nope" },
              },
              identity: {
                agent: "default",
                claims: { email: "user@example.com" },
                label: "drop me",
              },
              rule: "entities.api_key",
              span: { path: "", start: 0, end: 10, value: "sk_test_FAKE" },
              contentHash: "b".repeat(64),
              value: "sk_test_FAKE",
              context: { text: "secret" },
              appliedAs: "mask",
            },
          ],
        },
      ],
    });

    expect(events).toEqual([
      {
        type: "check",
        workflowId: "wf-1",
        timestamp: 1,
        decisions: [
          {
            action: "block",
            entity: "api_key",
            boundary: { kind: "model", provider: "test" },
            identity: { agent: "default" },
            rule: "entities.api_key",
            span: { path: "", start: 0, end: 10 },
            contentHash: "b".repeat(64),
            appliedAs: "mask",
          },
        ],
      },
    ]);
    const stored = JSON.stringify(events);
    expect(stored).not.toContain("sk_test_FAKE");
    expect(stored).not.toContain("user@example.com");
    expect(stored).not.toContain("nested leak");
  });

  it("rejects malformed decisions missing required nested shapes", () => {
    expect(() =>
      parseAuditBatch({
        events: [
          {
            ...sampleEvent(),
            decisions: [
              {
                action: "block",
                entity: "email",
                rule: "entities.email",
                contentHash: "c".repeat(64),
                span: { path: "", start: 0, end: 1 },
                identity: { agent: "default" },
              },
            ],
          },
        ],
      }),
    ).toThrow(/boundary/);

    expect(() =>
      parseAuditBatch({
        events: [
          {
            ...sampleEvent(),
            decisions: [
              {
                ...sampleEvent().decisions[0],
                identity: {},
              },
            ],
          },
        ],
      }),
    ).toThrow(/identity\.agent/);
  });
});

describe("generateApiKey", () => {
  it("hashes without exposing the raw key in the hash", async () => {
    const key = await generateApiKey();
    expect(key.hash).not.toContain(key.raw);
    expect(key.hash).toHaveLength(64);
  });
});
