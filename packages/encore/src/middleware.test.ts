/**
 * Encore middleware helpers: request block / tokenize without full Encore runtime.
 */

import { describe, expect, it, vi } from "vitest";
import { createTailrace, memoryVault, PolicyViolationError } from "@tailrace/core";

import { checkEncoreOpenAiBody, tailraceEncore } from "./middleware";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "encore@example.com";

const { MockHandlerResponse } = vi.hoisted(() => {
  class MockHandlerResponse {
    payload: unknown;
    status?: number;
    constructor(payload: unknown) {
      this.payload = payload;
    }
  }
  return { MockHandlerResponse };
});

vi.mock("encore.dev/api", () => ({
  middleware: (_opts: unknown, handler: unknown) => handler,
  HandlerResponse: MockHandlerResponse,
}));

type MockHandlerResponseInstance = InstanceType<typeof MockHandlerResponse>;

type TypedMiddlewareFn = (
  req: { data: { payload: unknown } },
  next: (req: unknown) => Promise<MockHandlerResponseInstance>,
) => Promise<MockHandlerResponseInstance>;

describe("checkEncoreOpenAiBody", () => {
  it("throws when request contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "en-req-secret" }) });
    await expect(
      checkEncoreOpenAiBody(tailrace, {
        model: "gpt-4o",
        messages: [{ role: "user", content: `use ${SECRET}` }],
      }),
    ).rejects.toBeInstanceOf(PolicyViolationError);
  });

  it("tokenizes email in request body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "en-req-email" }) });
    const out = await checkEncoreOpenAiBody(
      tailrace,
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: `hello ${EMAIL}` }],
      },
      { workflowId: "w1" },
    );
    const content = out.messages?.[0]?.content;
    expect(typeof content).toBe("string");
    expect(content as string).not.toContain(EMAIL);
    expect(content as string).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("tailraceEncore", () => {
  it("returns an Encore middleware handler function", () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "en-mw" }) });
    const mw = tailraceEncore(tailrace, { agent: "api" });
    expect(typeof mw).toBe("function");
  });
});

describe("tailraceEncore handleTyped", () => {
  it("returns a policy_violation response instead of throwing when a typed request contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "en-typed-req-secret" }) });
    const mw = tailraceEncore(tailrace, { agent: "api" }) as unknown as TypedMiddlewareFn;
    const next = vi.fn();

    const resp = await mw(
      {
        data: {
          payload: {
            model: "gpt-4o",
            messages: [{ role: "user", content: `use ${SECRET}` }],
          },
        },
      },
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(resp.status).toBe(422);
    expect(JSON.stringify(resp.payload)).not.toContain(SECRET);
  });

  it("returns a policy_violation response instead of throwing when a typed response leaks a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "en-typed-res-secret" }) });
    const mw = tailraceEncore(tailrace, { agent: "api" }) as unknown as TypedMiddlewareFn;
    const next = vi.fn(async () =>
      Promise.resolve(
        new MockHandlerResponse({
          choices: [{ message: { role: "assistant", content: `leak ${SECRET}` } }],
        }),
      ),
    );

    const resp = await mw(
      { data: { payload: { model: "gpt-4o", messages: [{ role: "user", content: "say hi" }] } } },
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(resp.status).toBe(422);
    expect(JSON.stringify(resp.payload)).not.toContain(SECRET);
  });
});
