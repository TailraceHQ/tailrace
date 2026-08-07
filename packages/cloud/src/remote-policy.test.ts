import { createTailrace, defaultPolicy, definePolicy } from "@tailrace/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { remotePolicy } from "./remote-policy";

function jsonResponse(body: unknown, init?: { status?: number; etag?: string }): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init?.etag !== undefined) headers.set("ETag", init.etag);
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers,
  });
}

describe("remotePolicy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads a versioned policy envelope", async () => {
    const doc = definePolicy({ entities: { email: "mask" } });
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ version: 2, document: doc, publishedAt: "2026-01-01T00:00:00.000Z" }),
    );

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const loaded = await source.load();
    expect(loaded.entities?.email).toBe("mask");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://plane.test/api/v1/policy",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer tr_test_key" }),
      }),
    );
  });

  it("falls back to last-known-good when the plane goes down", async () => {
    const doc = definePolicy({ entities: { email: "mask" } });
    let fail = false;
    const fetchImpl = vi.fn(async () => {
      if (fail) throw new Error("ECONNREFUSED");
      return jsonResponse({ version: 1, document: doc });
    });

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await source.load();
    fail = true;
    const loaded = await source.load();
    expect(loaded.entities?.email).toBe("mask");
  });

  it("uses defaultPolicy on cold-start failure and does not throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const loaded = await source.load();
    expect(loaded).toEqual(defaultPolicy());
  });

  it("keeps enforcing last-known-good via createTailrace when the plane dies", async () => {
    const doc = definePolicy({
      entities: { email: "mask" },
      defaults: { action: "allow" },
    });
    let fail = false;
    const fetchImpl = vi.fn(async () => {
      if (fail) throw new Error("killed");
      return jsonResponse({ version: 1, document: doc });
    });

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const gate = createTailrace({ policy: source });
    const first = await gate.check("write alice@example.com", {
      boundary: { kind: "model", provider: "openai/gpt-4o" },
      identity: { agent: "default" },
    });
    expect(first.output).toContain("[EMAIL]");
    expect(String(first.output)).not.toContain("alice@example.com");

    fail = true;
    // Force a reload path: create a fresh gate on the same source (cached LKG).
    const gate2 = createTailrace({ policy: source });
    const second = await gate2.check("write bob@example.com", {
      boundary: { kind: "model", provider: "openai/gpt-4o" },
      identity: { agent: "default" },
    });
    expect(second.output).toContain("[EMAIL]");
    expect(String(second.output)).not.toContain("bob@example.com");
  });

  it("subscribe polls and notifies on change", async () => {
    vi.useFakeTimers();
    let version = 1;
    const fetchImpl = vi.fn(async () => {
      const doc = definePolicy({
        entities: { email: version === 1 ? "mask" : "tokenize" },
        defaults: { action: "allow" },
      });
      return jsonResponse({ version, document: doc }, { etag: `"v${String(version)}"` });
    });

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      pollIntervalMs: 1000,
      fetch: fetchImpl as unknown as typeof fetch,
    });

    await source.load();
    const seen: string[] = [];
    const unsub = source.subscribe?.((p) => {
      const email = p.entities?.email;
      seen.push(typeof email === "string" ? email : String(email));
    });

    version = 2;
    await vi.advanceTimersByTimeAsync(1000);
    // Allow the async pull to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(seen.some((a) => a === "tokenize")).toBe(true);
    unsub?.();
  });

  it("rejects invalid policy documents from the plane", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ version: 1, document: { entities: { email: "review" } } }),
    );

    const source = remotePolicy("https://plane.test/api/v1/policy", {
      apiKey: "tr_test_key",
      fetch: fetchImpl as unknown as typeof fetch,
    });

    // Invalid remote doc → treat as fetch failure → cold-start fallback
    const loaded = await source.load();
    expect(loaded).toEqual(defaultPolicy());
  });
});
