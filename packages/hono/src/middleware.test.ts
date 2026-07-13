/**
 * tailraceHono unit tests: request 422, tokenize, JSON response, SSE abort.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import { Hono } from "hono";

import { tailraceHono } from "./middleware";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "hono@example.com";

function chatBody(text: string, model = "gpt-4o"): object {
  return {
    model,
    messages: [{ role: "user", content: text }],
  };
}

function makeApp(
  tailrace: ReturnType<typeof createTailrace>,
  upstream: (c: import("hono").Context) => Response | Promise<Response>,
  opts?: Parameters<typeof tailraceHono>[1],
) {
  const app = new Hono();
  app.use("/v1/*", tailraceHono(tailrace, opts));
  app.post("/v1/chat/completions", (c) => upstream(c));
  return app;
}

describe("tailraceHono request path", () => {
  it("returns 422 when request contains a secret", async () => {
    let reached = false;
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-req-secret" }) });
    const app = makeApp(tailrace, () => {
      reached = true;
      return new Response("{}");
    });

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chatBody(`use ${SECRET}`)),
    });

    expect(res.status).toBe(422);
    expect(reached).toBe(false);
    const body = (await res.json()) as {
      error: { type: string; entity: string; rule: string };
    };
    expect(body.error.type).toBe("policy_violation");
    expect(body.error.entity).toBe("api_key");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("tokenizes email in forwarded request body", async () => {
    let forwarded: string | undefined;
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-req-email" }) });
    const app = makeApp(
      tailrace,
      async (c) => {
        forwarded = await c.req.text();
        return c.json({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        });
      },
      { workflowId: "w1" },
    );

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chatBody(`hello ${EMAIL}`)),
    });

    expect(res.status).toBe(200);
    expect(forwarded).toBeDefined();
    expect(forwarded).not.toContain(EMAIL);
    expect(forwarded).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("wires agent from header callback", async () => {
    const seen: string[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-agent" }) });
    const app = makeApp(
      tailrace,
      (c) =>
        c.json({
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
      {
        agent: (c) => c.req.header("x-agent-id") ?? "default",
        onDecision: (ds) => {
          for (const d of ds) seen.push(d.identity.agent);
        },
      },
    );

    await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-agent-id": "support-bot",
      },
      body: JSON.stringify(chatBody(`hello ${EMAIL}`)),
    });

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((a) => a === "support-bot")).toBe(true);
  });
});

describe("tailraceHono JSON response", () => {
  it("returns 422 when completion contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-res-secret" }) });
    const app = makeApp(tailrace, (c) =>
      c.json({
        choices: [{ message: { role: "assistant", content: `leak ${SECRET}` } }],
      }),
    );

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chatBody("say hi")),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { entity: string } };
    expect(body.error.entity).toBe("api_key");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("tokenizes email in completion body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-res-email" }) });
    const app = makeApp(
      tailrace,
      (c) =>
        c.json({
          choices: [{ message: { role: "assistant", content: `contact ${EMAIL}` } }],
        }),
      { workflowId: "w2" },
    );

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chatBody("lookup")),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const text = body.choices[0]!.message.content;
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("tailraceHono SSE", () => {
  function sseResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) {
          const data = JSON.stringify({
            choices: [{ delta: { content: c }, index: 0 }],
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  }

  async function readSseText(res: Response): Promise<string> {
    const text = await res.text();
    const parts: string[] = [];
    for (const line of text.split("\n")) {
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
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-sse-secret" }) });
    // Split mid secret so carry-buffer must catch it.
    const chunks = ["sk_test_", "51FakeKeyForTailraceTests000FAKE"];
    const app = makeApp(tailrace, () => sseResponse(chunks));

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...chatBody("stream"), stream: true }),
    });

    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream");
    const text = await readSseText(res);
    expect(text).toContain("ERROR:api_key");
    expect(text).not.toContain(SECRET);
  });

  it("tokenizes email across 1-char SSE chunks", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "hono-sse-email" }) });
    const chunks = [...`hi ${EMAIL}`];
    const app = makeApp(tailrace, () => sseResponse(chunks), { workflowId: "w3" });

    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...chatBody("stream"), stream: true }),
    });

    const text = await readSseText(res);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});
