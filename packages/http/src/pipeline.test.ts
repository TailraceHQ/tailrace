/**
 * @tailrace/http pipeline + SSE unit tests.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault, PolicyViolationError } from "@tailrace/core";

import {
  createOpenAiCompatSseTransform,
  parseOpenAiBody,
  POLICY_VIOLATION_STATUS,
  policyViolationBody,
  runOpenAiCompatJsonResponseCheck,
  runOpenAiCompatRequestCheck,
} from "./index";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "http@example.com";

function chatBody(text: string, model = "gpt-4o"): object {
  return {
    model,
    messages: [{ role: "user", content: text }],
  };
}

describe("runOpenAiCompatRequestCheck", () => {
  it("throws PolicyViolationError when request contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-req-secret" }) });
    const body = parseOpenAiBody(chatBody(`use ${SECRET}`))!;
    let err: unknown;
    try {
      await runOpenAiCompatRequestCheck(tailrace, body);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(PolicyViolationError);
    const pb = policyViolationBody(err as PolicyViolationError);
    expect(pb.error.type).toBe("policy_violation");
    expect(pb.error.entity).toBe("api_key");
    expect(JSON.stringify(pb)).not.toContain(SECRET);
    expect(POLICY_VIOLATION_STATUS).toBe(422);
  });

  it("tokenizes email in request body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-req-email" }) });
    const body = parseOpenAiBody(chatBody(`hello ${EMAIL}`))!;
    const { body: out } = await runOpenAiCompatRequestCheck(tailrace, body, {
      workflowId: "w1",
    });
    const content = out.messages?.[0]?.content;
    expect(typeof content).toBe("string");
    expect(content as string).not.toContain(EMAIL);
    expect(content as string).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("runOpenAiCompatJsonResponseCheck", () => {
  it("throws when completion contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-res-secret" }) });
    const json = {
      choices: [{ message: { role: "assistant", content: `leak ${SECRET}` } }],
    };
    await expect(
      runOpenAiCompatJsonResponseCheck(tailrace, json, {
        kind: "model",
        provider: "gpt-4o",
      }),
    ).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("tokenizes email in completion body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-res-email" }) });
    const json = {
      choices: [{ message: { role: "assistant", content: `contact ${EMAIL}` } }],
    };
    const next = (await runOpenAiCompatJsonResponseCheck(
      tailrace,
      json,
      { kind: "model", provider: "gpt-4o" },
      { workflowId: "w2" },
    )) as { choices: Array<{ message: { content: string } }> };
    const text = next.choices[0]!.message.content;
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("createOpenAiCompatSseTransform", () => {
  function sseUpstream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
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
  }

  async function readSseText(stream: ReadableStream<Uint8Array>): Promise<string> {
    const text = await new Response(stream).text();
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
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-sse-secret" }) });
    const chunks = ["sk_test_", "51FakeKeyForTailraceTests000FAKE"];
    const scanned = createOpenAiCompatSseTransform(
      tailrace,
      { kind: "model", provider: "gpt-4o" },
      undefined,
      sseUpstream(chunks),
    );
    const text = await readSseText(scanned);
    expect(text).toContain("ERROR:api_key");
    expect(text).not.toContain(SECRET);
  });

  it("tokenizes email across 1-char SSE chunks", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "http-sse-email" }) });
    const chunks = [...`hi ${EMAIL}`];
    const scanned = createOpenAiCompatSseTransform(
      tailrace,
      { kind: "model", provider: "gpt-4o" },
      { workflowId: "w3" },
      sseUpstream(chunks),
    );
    const text = await readSseText(scanned);
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});
