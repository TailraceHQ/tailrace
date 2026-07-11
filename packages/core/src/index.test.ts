import { describe, expect, it } from "vitest";

import { createTailrace, definePolicy, NotImplementedError, staticPolicy } from "./index";

const ctx = {
  boundary: { kind: "telemetry" as const },
  identity: { agent: "default" },
};

describe("@tailrace/core M0 skeleton", () => {
  it("createTailrace().check is not implemented until M2", () => {
    const tailrace = createTailrace();
    expect(() => tailrace.check("hello", ctx)).toThrow(NotImplementedError);
  });

  it("staticPolicy wraps a document as a PolicySource", async () => {
    const source = staticPolicy(definePolicy({ entities: { email: "tokenize" } }));
    await expect(source.load()).resolves.toEqual({ entities: { email: "tokenize" } });
  });

  it("definePolicy is a typed passthrough for now", () => {
    const doc = definePolicy({ defaults: { action: "block" } });
    expect(doc.defaults?.action).toBe("block");
  });
});
