import { createTailrace } from "@tailrace/core";
import { describe, expect, it } from "vitest";

import { asCheckable, unwrapCheckable } from "./checkable";
import { formatToolBlockError } from "./errors";
import { runGoverned } from "./run-governed";
import { wrapToolExecute } from "./wrap-tool-execute";
import { PolicyViolationError } from "@tailrace/core";

const EMAIL = "user@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForFixturesOnly000FAKE";

describe("asCheckable / unwrapCheckable", () => {
  it("passes strings and plain objects through", () => {
    expect(asCheckable("hi")).toBe("hi");
    expect(asCheckable({ a: 1 })).toEqual({ a: 1 });
    expect(unwrapCheckable("hi", "bye")).toBe("bye");
    expect(unwrapCheckable({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("wraps primitives and arrays under value", () => {
    expect(asCheckable(42)).toEqual({ value: 42 });
    expect(asCheckable([1, 2])).toEqual({ value: [1, 2] });
    expect(unwrapCheckable(42, { value: 99 })).toBe(99);
  });
});

describe("formatToolBlockError", () => {
  it("never includes the raw value", () => {
    const err = new PolicyViolationError("blocked", [
      {
        action: "block",
        entity: "api_key",
        boundary: { kind: "tool", name: "crm", direction: "out" },
        identity: { agent: "default" },
        rule: "entities.api_key",
        span: { path: "", start: 0, end: 10 },
        contentHash: "abc",
      },
    ]);
    const msg = formatToolBlockError(err);
    expect(msg).toContain("api_key");
    expect(msg).toContain("tool:crm:out");
    expect(msg).not.toContain(FAKE_KEY);
  });
});

describe("wrapToolExecute", () => {
  it("tokenizes email in args and returns rewritten result", async () => {
    const tailrace = createTailrace();
    const execute = wrapToolExecute(
      tailrace,
      "crm",
      async (args: unknown) => {
        const a = args as { email: string };
        expect(a.email).not.toBe(EMAIL);
        expect(a.email).toMatch(/^<EMAIL_/);
        return { echo: a.email };
      },
      { workflowId: "adapter-w1", agent: "support" },
    );

    const out = (await execute({ email: EMAIL })) as { echo: string };
    expect(out.echo).toMatch(/^<EMAIL_/);
  });

  it("blocks api_key in outbound args", async () => {
    const tailrace = createTailrace();
    const execute = wrapToolExecute(tailrace, "post", async (_args: { body: string }) => "ok", {
      workflowId: "adapter-w2",
    });

    await expect(execute({ body: FAKE_KEY })).rejects.toThrow(/api_key/);
  });
});

describe("runGoverned", () => {
  it("rewrites input and runs handler when allowed", async () => {
    const tailrace = createTailrace();
    const result = await runGoverned(
      tailrace,
      {
        boundary: { kind: "tool", name: "crm", direction: "out" },
        input: { email: EMAIL },
        workflowId: "adapter-rg1",
        checkResult: true,
      },
      async (input) => {
        const i = input as { email: string };
        expect(i.email).not.toBe(EMAIL);
        return { email: i.email };
      },
    );

    expect(result.allowed).toBe(true);
    expect((result.output as { email: string }).email).toMatch(/^<EMAIL_/);
  });

  it("returns allowed false on block without running handler", async () => {
    let ran = false;
    const tailrace = createTailrace();
    const result = await runGoverned(
      tailrace,
      {
        boundary: { kind: "tool", name: "post", direction: "out" },
        input: { key: FAKE_KEY },
        workflowId: "adapter-rg2",
      },
      async () => {
        ran = true;
        return "ok";
      },
    );

    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/api_key/);
    expect(ran).toBe(false);
  });
});
