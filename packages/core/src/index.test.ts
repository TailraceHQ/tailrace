/**
 * End-to-end createTailrace check/restore tests (M2 acceptance).
 */

import { describe, expect, it, vi } from "vitest";

import {
  InvariantViolationError,
  PolicyViolationError,
  consoleSink,
  createTailrace,
  definePolicy,
  jsonlSink,
  memoryVault,
  staticPolicy,
} from "./index";
import type { Boundary } from "./types";

const modelCtx = {
  boundary: { kind: "model" as const, provider: "openai/gpt-4o" },
  identity: { agent: "default" },
  workflowId: "wf-demo",
};

const egressCtx = {
  boundary: { kind: "egress" as const, sink: "ui" },
  identity: { agent: "default" },
  workflowId: "wf-demo",
};

describe("createTailrace zero-config", () => {
  it("blocks a Stripe-like api key", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    // Synthetic key: sk_test_ prefix + FAKE marker (never a real secret).
    const input = "please use " + "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
    await expect(tailrace.check(input, modelCtx)).rejects.toBeInstanceOf(PolicyViolationError);
    try {
      await tailrace.check(input, modelCtx);
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyViolationError);
      const e = err as PolicyViolationError;
      expect(e.message).toContain("api_key");
      expect(e.message).not.toContain("sk_test_");
      expect(e.decisions.some((d) => d.entity === "api_key")).toBe(true);
    }
  });

  it("tokenizes an email", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    const email = "customer@example.com";
    const { output, decisions } = await tailrace.check(`hello ${email}`, modelCtx);
    expect(typeof output).toBe("string");
    expect(output).not.toContain(email);
    expect(output).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    expect(decisions.some((d) => d.entity === "email" && d.action === "tokenize")).toBe(true);
    expect(decisions.every((d) => d.contentHash.length === 64)).toBe(true);
  });

  it("applyBlockAs: mask remaps block without throwing", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    const secret = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
    const { output, decisions } = await tailrace.check(`key ${secret}`, modelCtx, {
      applyBlockAs: "mask",
    });
    expect(output).toBe("key [API_KEY]");
    expect(output).not.toContain(secret);
    const blocked = decisions.find((d) => d.entity === "api_key");
    expect(blocked?.action).toBe("block");
    expect(blocked?.appliedAs).toBe("mask");
  });

  it("default check still throws on block when applyBlockAs is unset", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    const secret = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
    await expect(tailrace.check(`key ${secret}`, modelCtx)).rejects.toBeInstanceOf(
      PolicyViolationError,
    );
  });

  it("stream holdback: never bisects a straddling email; remainder stays raw", async () => {
    const tailrace = createTailrace({ vault: { key: "stream-cut" } });
    const email = "john.doe@example.com";
    const holdback = 128;
    const len = holdback + 100;
    const tentativeCut = len - holdback;
    const emailStart = tentativeCut - 5;
    // Padding must not extend an email local-part (avoid [a-z0-9._%+-]+ greed).
    const pad = (n: number) => "#".repeat(n);
    const text = pad(emailStart) + email + pad(len - emailStart - email.length);

    const { output, remainder, decisions } = await tailrace.check(text, modelCtx, {
      stream: { holdback, final: false },
    });

    expect(output).toBe(pad(emailStart));
    expect(output).not.toContain("john.do");
    expect(remainder?.startsWith(email)).toBe(true);
    expect(decisions.every((d) => d.entity !== "email")).toBe(true);

    const flushed = await tailrace.check(remainder!, modelCtx, {
      stream: { holdback, final: true },
    });
    expect(flushed.output).not.toContain(email);
    expect(flushed.output).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("restore", () => {
  it("round-trips tokenized email at egress", async () => {
    const vault = memoryVault({ key: "test-key" });
    const tailrace = createTailrace({ vault });
    const email = "customer@example.com";
    const checked = await tailrace.check(`hi ${email}`, modelCtx);
    const restored = await tailrace.restore(checked.output, egressCtx);
    expect(restored.output).toBe(`hi ${email}`);
    expect(restored.decisions.some((d) => d.action === "detokenize")).toBe(true);
  });

  it("round-trips format-preserving email/phone/credit_card", async () => {
    const vault = memoryVault({ key: "fpe-key" });
    const tailrace = createTailrace({
      vault,
      policy: definePolicy({
        entities: {
          email: { action: "tokenize", format: "preserve" },
          phone: { action: "tokenize", format: "preserve" },
          credit_card: { action: "tokenize", format: "preserve" },
        },
        boundaries: {
          "egress:*": { entities: { "*": "detokenize" } },
        },
      }),
    });
    const email = "fpe@example.com";
    // 555 fictional range (docs/conventions.md).
    const phone = "+1 (555) 010-1234";
    // Synthetic 4242 test PAN (docs/conventions.md).
    const card = "4242 4242 4242 4242";

    const emailChecked = await tailrace.check(email, { ...modelCtx, workflowId: "fpe" });
    expect(String(emailChecked.output)).toMatch(/^[a-z0-9]{8}@redacted\.example$/);
    const emailRestored = await tailrace.restore(emailChecked.output, {
      ...egressCtx,
      workflowId: "fpe",
    });
    expect(emailRestored.output).toBe(email);

    const phoneChecked = await tailrace.check(phone, { ...modelCtx, workflowId: "fpe" });
    expect(String(phoneChecked.output)).toMatch(/^\+1555\d{7}$/);
    const phoneRestored = await tailrace.restore(phoneChecked.output, {
      ...egressCtx,
      workflowId: "fpe",
    });
    expect(phoneRestored.output).toBe(phone);

    const cardChecked = await tailrace.check(`card ${card}`, {
      ...modelCtx,
      workflowId: "fpe",
    });
    expect(String(cardChecked.output)).not.toContain("4242 4242 4242 4242");
    expect(String(cardChecked.output)).toMatch(/^card 9/);
    const cardRestored = await tailrace.restore(cardChecked.output, {
      ...egressCtx,
      workflowId: "fpe",
    });
    expect(cardRestored.output).toBe(`card ${card}`);
  });

  it("hard invariant: restore at model/tool/mcp/telemetry throws even if policy wants detokenize", async () => {
    // Policy cannot place detokenize on non-egress via definePolicy; the invariant is
    // enforced in restore itself regardless of policy content.
    const tailrace = createTailrace({
      vault: { key: "inv-key" },
      policy: definePolicy({
        defaults: { action: "allow" },
        boundaries: {
          "egress:*": { entities: { "*": "detokenize" } },
        },
      }),
    });
    const nonEgress: Boundary[] = [
      { kind: "model", provider: "openai/gpt-4o" },
      { kind: "tool", name: "crm", direction: "out" },
      { kind: "mcp", server: "salesforce", tool: "update", direction: "out" },
      { kind: "telemetry" },
    ];
    for (const boundary of nonEgress) {
      await expect(
        tailrace.restore("<EMAIL_abcdefgh>", {
          boundary,
          identity: { agent: "default" },
          workflowId: "inv",
        }),
      ).rejects.toBeInstanceOf(InvariantViolationError);
    }
  });

  it("leaves unknown tokens as-is with restore_miss", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    const input = "see <EMAIL_deadbeef>";
    const { output, decisions } = await tailrace.restore(input, egressCtx);
    expect(output).toBe(input);
    expect(decisions.some((d) => d.action === "restore_miss")).toBe(true);
  });
});

describe("token stability across 50 steps", () => {
  it("emits the identical token for the same email across boundaries", async () => {
    const vault = memoryVault({ key: "stable-key" });
    const tailrace = createTailrace({ vault });
    const email = "stable@example.com";
    const workflowId = "loop-50";
    const tokens: string[] = [];

    for (let step = 0; step < 50; step++) {
      const boundary =
        step % 2 === 0
          ? { kind: "model" as const, provider: "openai/gpt-4o" }
          : { kind: "tool" as const, name: "crm", direction: "out" as const };
      const { output } = await tailrace.check(`customer ${email}`, {
        boundary,
        identity: { agent: "default" },
        workflowId,
      });
      const match = String(output).match(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
      expect(match).not.toBeNull();
      tokens.push(match![0]!);
    }

    expect(new Set(tokens).size).toBe(1);

    const restored = await tailrace.restore(`done ${tokens[0]}`, {
      boundary: { kind: "egress", sink: "ui" },
      identity: { agent: "default" },
      workflowId,
    });
    expect(restored.output).toBe(`done ${email}`);
  });
});

describe("audit sinks", () => {
  it("emits JSONL without raw values", async () => {
    const lines: string[] = [];
    const email = "audit@example.com";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const tailrace = createTailrace({
      vault: { key: "audit-key" },
      audit: {
        sinks: [
          jsonlSink({
            write: (l) => {
              lines.push(l);
            },
          }),
          consoleSink(),
        ],
      },
    });
    await tailrace.check(`hi ${email}`, modelCtx);
    spy.mockRestore();
    expect(lines.length).toBeGreaterThan(0);
    const joined = lines.join("");
    expect(joined).not.toContain(email);
    expect(joined).toContain("contentHash");
    expect(joined).toContain("rule");
  });

  it("fail-open: a throwing sink does not crash check", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tailrace = createTailrace({
      vault: { key: "audit-fail" },
      audit: {
        sinks: [
          {
            emit() {
              throw new Error("sink exploded");
            },
          },
          jsonlSink({
            write: () => {
              /* ok */
            },
          }),
        ],
      },
    });
    await expect(tailrace.check("hello@example.com", modelCtx)).resolves.toMatchObject({
      blocked: false,
    });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("audit sink failed"))).toBe(true);
    warn.mockRestore();
  });

  it("fail-open: a rejecting async sink does not crash check", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tailrace = createTailrace({
      vault: { key: "audit-reject" },
      audit: {
        sinks: [
          {
            emit() {
              return Promise.reject(new Error("async sink boom"));
            },
          },
        ],
      },
    });
    await expect(tailrace.check("hello@example.com", modelCtx)).resolves.toMatchObject({
      blocked: false,
    });
    // Allow the microtask for .catch to run.
    await Promise.resolve();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("audit sink failed"))).toBe(true);
    warn.mockRestore();
  });
});

describe("staticPolicy + definePolicy wiring", () => {
  it("loads a custom policy via PolicySource", async () => {
    const tailrace = createTailrace({
      vault: { key: "x" },
      policy: staticPolicy(definePolicy({ entities: { email: "mask" } })),
    });
    const { output } = await tailrace.check("a@example.com", modelCtx);
    expect(output).toBe("[EMAIL]");
  });
});

describe("error messages never contain raw values", () => {
  it("PolicyViolationError message omits the detected key", async () => {
    const tailrace = createTailrace({ vault: { key: "test-key" } });
    const secret = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
    try {
      await tailrace.check(secret, modelCtx);
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyViolationError);
      const msg = (err as Error).message;
      expect(msg).not.toContain(secret);
      expect(msg).not.toContain("FakeKey");
    }
  });
});
