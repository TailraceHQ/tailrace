import { createTailrace, definePolicy } from "@tailrace/core";
import { describe, expect, it, vi } from "vitest";

import { PRIVACY_FILTER_ID2LABEL } from "./labels";
import { nerRecommendedPolicy } from "./policy";
import { nerRecognizer } from "./recognizer";

describe("nerRecognizer", () => {
  it("emits person spans from injected logits (no ONNX)", async () => {
    const text = "hello Alice";
    const recognizer = nerRecognizer({
      tokenize: () => ({
        inputIds: [1, 2],
        charStarts: [0, 6],
        charEnds: [6, 11],
      }),
      inferLogits: () => {
        const numClasses = PRIVACY_FILTER_ID2LABEL.length;
        const seqLen = 2;
        const logits = new Float32Array(seqLen * numClasses);
        logits[0] = 5; // O
        logits[numClasses + 20] = 10; // S-private_person on token 1
        return logits;
      },
    });

    const spans = await recognizer.scan(text);
    expect(spans).toEqual([expect.objectContaining({ entity: "person", start: 6, end: 11 })]);
  });

  it("fail-opens when modelPath is missing and no inferLogits", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recognizer = nerRecognizer({});
    expect(await recognizer.scan("hello Alice")).toEqual([]);
    expect(await recognizer.scan("again")).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("integrates with createTailrace and blocks Tier 1 secret via default policy", async () => {
    const text = "leak HERE";
    const recognizer = nerRecognizer({
      tokenize: () => ({
        inputIds: [1, 2],
        charStarts: [0, 5],
        charEnds: [5, 9],
      }),
      inferLogits: () => {
        const numClasses = PRIVACY_FILTER_ID2LABEL.length;
        const logits = new Float32Array(2 * numClasses);
        logits[0] = 5;
        logits[numClasses + 32] = 10; // S-secret
        return logits;
      },
    });

    const gate = createTailrace({ recognizers: [recognizer] });
    await expect(
      gate.check(text, {
        boundary: { kind: "model", provider: "test/model" },
        identity: { agent: "default" },
      }),
    ).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
  });
});

describe("nerRecommendedPolicy", () => {
  it("tokenizes person when merged; does not auto-apply without merge", async () => {
    const text = "hello Alice";
    const recognizer = nerRecognizer({
      tokenize: () => ({
        inputIds: [1, 2],
        charStarts: [0, 6],
        charEnds: [6, 11],
      }),
      inferLogits: () => {
        const numClasses = PRIVACY_FILTER_ID2LABEL.length;
        const logits = new Float32Array(2 * numClasses);
        logits[0] = 5;
        logits[numClasses + 20] = 10;
        return logits;
      },
    });

    const without = createTailrace({ recognizers: [recognizer] });
    const allowed = await without.check(text, {
      boundary: { kind: "model", provider: "test/model" },
      identity: { agent: "default" },
    });
    expect(allowed.output).toContain("Alice");

    const withRec = createTailrace({
      recognizers: [recognizer],
      policy: definePolicy({ entities: { ...nerRecommendedPolicy().entities } }),
    });
    const tokenized = await withRec.check(text, {
      boundary: { kind: "model", provider: "test/model" },
      identity: { agent: "default" },
    });
    expect(tokenized.output).not.toContain("Alice");
    expect(tokenized.decisions.some((d) => d.entity === "person" && d.action === "tokenize")).toBe(
      true,
    );
  });
});
