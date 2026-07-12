/**
 * wrapModel unit tests: transformParams, wrapGenerate, wrapStream.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault, PolicyViolationError } from "@tailrace/core";
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";

import { wrapModel } from "./wrap-model";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "model@example.com";

function mockModel(options: {
  provider?: string;
  modelId?: string;
  generateText?: string;
  streamChunks?: string[];
}): LanguageModelV2 {
  const provider = options.provider ?? "openai";
  const modelId = options.modelId ?? "gpt-4o";
  const generateText = options.generateText ?? "ok";
  const streamChunks = options.streamChunks;

  return {
    specificationVersion: "v2",
    provider,
    modelId,
    supportedUrls: {},
    async doGenerate() {
      return {
        content: [{ type: "text", text: generateText }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      };
    },
    async doStream() {
      const chunks = streamChunks ?? [generateText];
      const stream = new ReadableStream<LanguageModelV2StreamPart>({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "t1" });
          for (const c of chunks) {
            controller.enqueue({ type: "text-delta", id: "t1", delta: c });
          }
          controller.enqueue({ type: "text-end", id: "t1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      });
      return { stream };
    },
  };
}

async function readStreamText(stream: ReadableStream<LanguageModelV2StreamPart>): Promise<string> {
  const reader = stream.getReader();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.type === "text-delta") text += value.delta;
  }
  return text;
}

function userPrompt(text: string): LanguageModelV2CallOptions {
  return {
    prompt: [{ role: "user", content: [{ type: "text", text }] }],
  };
}

describe("wrapModel transformParams", () => {
  it("throws when prompt contains a secret (never reaches provider)", async () => {
    let reached = false;
    const inner = mockModel({});
    const original = inner.doGenerate.bind(inner);
    inner.doGenerate = async (opts) => {
      reached = true;
      return original(opts);
    };
    const tailrace = createTailrace({ vault: memoryVault({ key: "wm-in" }) });
    const model = wrapModel(tailrace, inner, { workflowId: "t1" });
    await expect(model.doGenerate(userPrompt(`use ${SECRET}`))).rejects.toBeInstanceOf(
      PolicyViolationError,
    );
    expect(reached).toBe(false);
  });

  it("tokenizes email in prompt params", async () => {
    const seen: string[] = [];
    const inner = mockModel({});
    const original = inner.doGenerate.bind(inner);
    inner.doGenerate = async (opts) => {
      const msg = opts.prompt[0];
      if (msg?.role === "user" && msg.content[0]?.type === "text") {
        seen.push(msg.content[0].text);
      }
      return original(opts);
    };
    const tailrace = createTailrace({ vault: memoryVault({ key: "wm-email" }) });
    const model = wrapModel(tailrace, inner, { workflowId: "t2" });
    await model.doGenerate(userPrompt(`hello ${EMAIL}`));
    expect(seen[0]).toBeDefined();
    expect(seen[0]).not.toContain(EMAIL);
    expect(seen[0]).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("wrapModel wrapGenerate", () => {
  it("throws when model output contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "wm-out" }) });
    const model = wrapModel(tailrace, mockModel({ generateText: `leak ${SECRET}` }), {
      workflowId: "g1",
    });
    await expect(model.doGenerate(userPrompt("hi"))).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("tokenizes email in model output", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "wm-out-e" }) });
    const model = wrapModel(tailrace, mockModel({ generateText: `hi ${EMAIL}` }), {
      workflowId: "g2",
    });
    const result = await model.doGenerate(userPrompt("hi"));
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("wrapModel wrapStream", () => {
  async function collect(
    behavior: "abort" | "buffer" | "redact",
    chunks: string[],
  ): Promise<string> {
    const tailrace = createTailrace({ vault: memoryVault({ key: `stream-${behavior}` }) });
    const model = wrapModel(tailrace, mockModel({ streamChunks: chunks }), {
      workflowId: `s-${behavior}`,
      streamBlockBehavior: behavior,
    });
    const { stream } = await model.doStream(userPrompt("hi"));
    return readStreamText(stream);
  }

  it("abort: 1-char chunks with email tokenizes", async () => {
    const text = `hello ${EMAIL} end`;
    const out = await collect(
      "abort",
      [...text].map((c) => c),
    );
    expect(out).not.toContain(EMAIL);
    expect(out).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("abort: chunk split mid sk_test_ throws", async () => {
    const chunks = ["hold ", "sk_test_", "51FakeKeyForTailraceTests000FAKE", " done"];
    const tailrace = createTailrace({ vault: memoryVault({ key: "split-secret" }) });
    const model = wrapModel(tailrace, mockModel({ streamChunks: chunks }), {
      workflowId: "split-s",
      streamBlockBehavior: "abort",
    });
    const { stream } = await model.doStream(userPrompt("hi"));
    await expect(readStreamText(stream)).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("abort: chunk split mid EMAIL token still tokenizes", async () => {
    // First produce a token via check, then stream that token split across chunks
    // to exercise carry around `<EMAIL_…>` shape on a tokenize-friendly input.
    const tailrace = createTailrace({ vault: memoryVault({ key: "split-tok" }) });
    const checked = await tailrace.check(`x ${EMAIL}`, {
      boundary: { kind: "model", provider: "openai/gpt-4o" },
      identity: { agent: "default" },
      workflowId: "split-tok",
    });
    const tokenized = String(checked.output);
    const mid = Math.floor(tokenized.length / 2);
    const out = await collect("abort", [tokenized.slice(0, mid), tokenized.slice(mid)]);
    // Already-tokenized text should pass through unchanged.
    expect(out.replace(/\s/g, "")).toContain(tokenized.replace(/\s/g, "").slice(0, 8));
  });

  it("buffer: accumulates then throws on secret", async () => {
    await expect(collect("buffer", ["hello ", SECRET, " world"])).rejects.toBeInstanceOf(
      PolicyViolationError,
    );
  });

  it("redact: stream completes with [API_KEY], no raw secret", async () => {
    const out = await collect(
      "redact",
      [...`leak ${SECRET}`].map((c) => c),
    );
    expect(out).toContain("[API_KEY]");
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain("sk_test_");
  });

  it("buffer: 1-char email tokenizes at end", async () => {
    const text = `hi ${EMAIL}`;
    const out = await collect(
      "buffer",
      [...text].map((c) => c),
    );
    expect(out).not.toContain(EMAIL);
    expect(out).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("abort: entity straddling carry cut does not leak local-part prefix", async () => {
    const { CARRY_BUFFER_SIZE } = await import("./stream/carry-buffer");
    const email = "john.doe@example.com";
    const len = CARRY_BUFFER_SIZE + 100;
    const tentativeCut = len - CARRY_BUFFER_SIZE;
    const emailStart = tentativeCut - 5;
    const pad = (n: number) => "#".repeat(n);
    const text = pad(emailStart) + email + pad(len - emailStart - email.length);

    const out = await collect("abort", [text]);
    expect(out).not.toContain("john.do");
    expect(out).not.toContain(email);
    expect(out).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("redact: secret straddling carry cut is fully masked, never cleartext", async () => {
    const { CARRY_BUFFER_SIZE } = await import("./stream/carry-buffer");
    const len = CARRY_BUFFER_SIZE + 100;
    const tentativeCut = len - CARRY_BUFFER_SIZE;
    const secretStart = tentativeCut - 5;
    const pad = (n: number) => "#".repeat(n);
    const text = pad(secretStart) + SECRET + pad(len - secretStart - SECRET.length);

    const out = await collect("redact", [text]);
    expect(out).toContain("[API_KEY]");
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain("sk_test_");
  });

  it("abort: onDecision fires once per applied emit (not probe+emit duplicate)", async () => {
    const { CARRY_BUFFER_SIZE } = await import("./stream/carry-buffer");
    const email = "once@example.com";
    const len = CARRY_BUFFER_SIZE + 80;
    const tentativeCut = len - CARRY_BUFFER_SIZE;
    const emailStart = tentativeCut - 4;
    const pad = (n: number) => "#".repeat(n);
    const text = pad(emailStart) + email + pad(len - emailStart - email.length);

    const decisionBatches: number[] = [];
    const tailrace = createTailrace({ vault: memoryVault({ key: "audit-once" }) });
    const model = wrapModel(tailrace, mockModel({ streamChunks: [text] }), {
      workflowId: "audit-once",
      streamBlockBehavior: "abort",
      onDecision: (d) => decisionBatches.push(d.length),
    });
    const { stream } = await model.doStream(userPrompt("hi"));
    const out = await readStreamText(stream);
    expect(out).not.toContain(email);
    // Prefix emit has no email decision; flush applies the email once.
    expect(decisionBatches.filter((n) => n > 0).length).toBe(1);
  });
});
