/**
 * tailraceFastify unit tests: request 422, tokenize, JSON response, SSE abort.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import Fastify from "fastify";
import { Readable } from "node:stream";

import { tailraceFastify } from "./plugin";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "fastify@example.com";

function chatBody(text: string, model = "gpt-4o"): object {
  return {
    model,
    messages: [{ role: "user", content: text }],
  };
}

async function makeApp(
  tailrace: ReturnType<typeof createTailrace>,
  upstream: (
    req: unknown,
    reply: {
      header: (k: string, v: string) => unknown;
      send: (p: unknown) => unknown;
      type: (t: string) => unknown;
    },
  ) => unknown | Promise<unknown>,
  opts?: Parameters<typeof tailraceFastify>[1],
) {
  const app = Fastify();
  await app.register(tailraceFastify(tailrace, opts));
  app.post("/v1/chat/completions", async (req, reply) => {
    return await upstream(req, reply);
  });
  await app.ready();
  return app;
}

describe("tailraceFastify request path", () => {
  it("returns 422 when request contains a secret", async () => {
    let reached = false;
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-req-secret" }) });
    const app = await makeApp(tailrace, () => {
      reached = true;
      return {};
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: chatBody(`use ${SECRET}`),
    });

    expect(res.statusCode).toBe(422);
    expect(reached).toBe(false);
    const body = res.json() as { error: { type: string; entity: string } };
    expect(body.error.type).toBe("policy_violation");
    expect(body.error.entity).toBe("api_key");
    expect(res.body).not.toContain(SECRET);
    await app.close();
  });

  it("tokenizes email in forwarded request body", async () => {
    let forwarded: unknown;
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-req-email" }) });
    const app = await makeApp(
      tailrace,
      (req) => {
        forwarded = (req as { body: unknown }).body;
        return { choices: [{ message: { role: "assistant", content: "ok" } }] };
      },
      { workflowId: "w1" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: chatBody(`hello ${EMAIL}`),
    });

    expect(res.statusCode).toBe(200);
    expect(forwarded).toBeDefined();
    const text = JSON.stringify(forwarded);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    await app.close();
  });
});

describe("tailraceFastify JSON response", () => {
  it("returns 422 when completion contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-res-secret" }) });
    const app = await makeApp(tailrace, () => ({
      choices: [{ message: { role: "assistant", content: `leak ${SECRET}` } }],
    }));

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: chatBody("say hi"),
    });

    expect(res.statusCode).toBe(422);
    const body = res.json() as { error: { entity: string } };
    expect(body.error.entity).toBe("api_key");
    expect(res.body).not.toContain(SECRET);
    await app.close();
  });

  it("tokenizes email in completion body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-res-email" }) });
    const app = await makeApp(
      tailrace,
      () => ({
        choices: [{ message: { role: "assistant", content: `contact ${EMAIL}` } }],
      }),
      { workflowId: "w2" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: chatBody("lookup"),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { choices: Array<{ message: { content: string } }> };
    const text = body.choices[0]!.message.content;
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    await app.close();
  });
});

describe("tailraceFastify SSE", () => {
  async function readSseText(raw: string): Promise<string> {
    const parts: string[] = [];
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trimStart();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { type?: string; entity?: string };
        };
        if (parsed.error?.type === "policy_violation") {
          parts.push(`ERROR:${parsed.error.entity}`);
          continue;
        }
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === "string") parts.push(content);
      } catch {
        /* ignore */
      }
    }
    return parts.join("");
  }

  it("aborts SSE and emits error when secret spans chunks", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-sse-secret" }) });
    const chunks = ["sk_test_", "51FakeKeyForTailraceTests000FAKE"];
    // Buffered SSE body (inject + streams is flaky); transform still scans line-by-line.
    const body = chunks
      .map((c) => {
        const data = JSON.stringify({
          choices: [{ delta: { content: c }, index: 0 }],
        });
        return `data: ${data}\n\n`;
      })
      .concat(["data: [DONE]\n\n"])
      .join("");
    const app = await makeApp(tailrace, (_req, reply) => {
      reply.type("text/event-stream");
      return body;
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: { ...chatBody("stream"), stream: true },
    });

    expect(String(res.headers["content-type"] ?? "")).toContain("text/event-stream");
    const text = await readSseText(res.body);
    expect(text).toContain("ERROR:api_key");
    expect(text).not.toContain(SECRET);
    await app.close();
  });

  it("tokenizes email across 1-char SSE chunks", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-sse-email" }) });
    const chunks = [...`hi ${EMAIL}`];
    const body = chunks
      .map((c) => {
        const data = JSON.stringify({
          choices: [{ delta: { content: c }, index: 0 }],
        });
        return `data: ${data}\n\n`;
      })
      .concat(["data: [DONE]\n\n"])
      .join("");
    const app = await makeApp(
      tailrace,
      (_req, reply) => {
        reply.type("text/event-stream");
        return body;
      },
      { workflowId: "w3" },
    );

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: { ...chatBody("stream"), stream: true },
    });

    expect(String(res.headers["content-type"] ?? "")).toContain("text/event-stream");
    const text = await readSseText(res.body);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    await app.close();
  });

  it("does not force non-SSE Readable payloads into the SSE transform", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "fy-sse-non-event-stream" }) });
    const fileBytes = "not-an-openai-stream\n";
    const app = await makeApp(tailrace, (_req, reply) => {
      reply.type("application/octet-stream");
      return Readable.from([Buffer.from(fileBytes)]);
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/chat/completions",
      payload: chatBody("download"),
    });

    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"] ?? "")).not.toContain("text/event-stream");
    expect(res.body).toBe(fileBytes);
    await app.close();
  });
});
