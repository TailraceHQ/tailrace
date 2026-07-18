/**
 * tailraceExpress unit tests: request 422, tokenize, JSON response, SSE abort.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import express from "express";
import request from "supertest";
import { Readable } from "node:stream";

import { tailraceExpress } from "./middleware";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "express@example.com";

function chatBody(text: string, model = "gpt-4o"): object {
  return {
    model,
    messages: [{ role: "user", content: text }],
  };
}

function makeApp(
  tailrace: ReturnType<typeof createTailrace>,
  upstream: (req: express.Request, res: express.Response) => void,
  opts?: Parameters<typeof tailraceExpress>[1],
) {
  const app = express();
  app.use(express.json());
  app.use("/v1", tailraceExpress(tailrace, opts));
  app.post("/v1/chat/completions", (req, res) => {
    upstream(req, res);
  });
  return app;
}

describe("tailraceExpress request path", () => {
  it("returns 422 when request contains a secret", async () => {
    let reached = false;
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-req-secret" }) });
    const app = makeApp(tailrace, (_req, res) => {
      reached = true;
      res.json({});
    });

    const res = await request(app)
      .post("/v1/chat/completions")
      .send(chatBody(`use ${SECRET}`));

    expect(res.status).toBe(422);
    expect(reached).toBe(false);
    expect(res.body.error.type).toBe("policy_violation");
    expect(res.body.error.entity).toBe("api_key");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it("tokenizes email in forwarded request body", async () => {
    let forwarded: unknown;
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-req-email" }) });
    const app = makeApp(
      tailrace,
      (req, res) => {
        forwarded = req.body;
        res.json({ choices: [{ message: { role: "assistant", content: "ok" } }] });
      },
      { workflowId: "w1" },
    );

    const res = await request(app)
      .post("/v1/chat/completions")
      .send(chatBody(`hello ${EMAIL}`));

    expect(res.status).toBe(200);
    expect(forwarded).toBeDefined();
    const text = JSON.stringify(forwarded);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("wires agent from header callback", async () => {
    const seen: string[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-agent" }) });
    const app = makeApp(
      tailrace,
      (_req, res) => {
        res.json({ choices: [{ message: { role: "assistant", content: "ok" } }] });
      },
      {
        agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
        onDecision: (ds) => {
          for (const d of ds) seen.push(d.identity.agent);
        },
      },
    );

    await request(app)
      .post("/v1/chat/completions")
      .set("x-agent-id", "support-bot")
      .send(chatBody(`hello ${EMAIL}`));

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((a) => a === "support-bot")).toBe(true);
  });
});

describe("tailraceExpress JSON response", () => {
  it("returns 422 when completion contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-res-secret" }) });
    const app = makeApp(tailrace, (_req, res) => {
      res.json({
        choices: [{ message: { role: "assistant", content: `leak ${SECRET}` } }],
      });
    });

    const res = await request(app).post("/v1/chat/completions").send(chatBody("say hi"));

    expect(res.status).toBe(422);
    expect(res.body.error.entity).toBe("api_key");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it("tokenizes email in completion body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-res-email" }) });
    const app = makeApp(
      tailrace,
      (_req, res) => {
        res.json({
          choices: [{ message: { role: "assistant", content: `contact ${EMAIL}` } }],
        });
      },
      { workflowId: "w2" },
    );

    const res = await request(app).post("/v1/chat/completions").send(chatBody("lookup"));

    expect(res.status).toBe(200);
    const text = res.body.choices[0].message.content as string;
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("fails closed (never ships the raw body) when the response check throws unexpectedly", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-res-fail-closed" }) });
    const originalCheck = tailrace.check.bind(tailrace);
    let calls = 0;
    tailrace.check = (async (...args: Parameters<typeof originalCheck>) => {
      calls += 1;
      if (calls === 2) throw new Error("boom");
      return originalCheck(...args);
    }) as typeof tailrace.check;

    const SENSITIVE_MARKER = "leaked-if-not-blocked";
    const app = makeApp(tailrace, (_req, res) => {
      res.json({
        choices: [{ message: { role: "assistant", content: SENSITIVE_MARKER } }],
      });
    });

    const res = await request(app).post("/v1/chat/completions").send(chatBody("say hi"));

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain(SENSITIVE_MARKER);
  });
});

describe("tailraceExpress SSE", () => {
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
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-sse-secret" }) });
    const chunks = ["sk_test_", "51FakeKeyForTailraceTests000FAKE"];
    const app = makeApp(tailrace, (_req, res) => {
      res.setHeader("content-type", "text/event-stream");
      const stream = Readable.from(
        chunks
          .map((c) => {
            const data = JSON.stringify({
              choices: [{ delta: { content: c }, index: 0 }],
            });
            return `data: ${data}\n\n`;
          })
          .concat(["data: [DONE]\n\n"]),
      );
      stream.pipe(res);
    });

    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ ...chatBody("stream"), stream: true })
      .buffer(true)
      .parse((res, cb) => {
        const data: Buffer[] = [];
        res.on("data", (c) => data.push(c as Buffer));
        res.on("end", () => {
          cb(null, Buffer.concat(data).toString("utf8"));
        });
      });

    expect(String(res.headers["content-type"] ?? "")).toContain("text/event-stream");
    const text = await readSseText(res.body as string);
    expect(text).toContain("ERROR:api_key");
    expect(text).not.toContain(SECRET);
  });

  it("tokenizes email across 1-char SSE chunks", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "ex-sse-email" }) });
    const chunks = [...`hi ${EMAIL}`];
    const app = makeApp(
      tailrace,
      (_req, res) => {
        res.setHeader("content-type", "text/event-stream");
        for (const c of chunks) {
          const data = JSON.stringify({
            choices: [{ delta: { content: c }, index: 0 }],
          });
          res.write(`data: ${data}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      },
      { workflowId: "w3" },
    );

    const res = await request(app)
      .post("/v1/chat/completions")
      .send({ ...chatBody("stream"), stream: true })
      .buffer(true)
      .parse((res, cb) => {
        const data: Buffer[] = [];
        res.on("data", (c) => data.push(c as Buffer));
        res.on("end", () => {
          cb(null, Buffer.concat(data).toString("utf8"));
        });
      });

    const text = await readSseText(res.body as string);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});
