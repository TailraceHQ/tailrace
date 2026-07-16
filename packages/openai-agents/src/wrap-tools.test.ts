import { createTailrace } from "@tailrace/core";
import { tool } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { withOpenAiAgents } from "./fluent";
import { wrapTool, wrapTools } from "./wrap-tools";

const EMAIL = "user@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForFixturesOnly000FAKE";

describe("wrapTool / wrapTools", () => {
  it("tokenizes email in invoke args", async () => {
    const tailrace = createTailrace();
    const crm = tool({
      name: "crm",
      description: "Lookup customer",
      parameters: z.object({ email: z.string() }),
      execute: async ({ email }) => {
        expect(email).not.toBe(EMAIL);
        expect(email).toMatch(/^<EMAIL_/);
        return { email };
      },
    });

    const wrapped = wrapTool(tailrace, crm, { workflowId: "oai-w1", agent: "support" });
    const result = await wrapped.invoke(
      // why: minimal RunContext stub; invoke only needs the shape for typing.
      {} as never,
      JSON.stringify({ email: EMAIL }),
    );
    expect(result).toMatchObject({ email: expect.stringMatching(/^<EMAIL_/) });
  });

  it("blocks api_key in outbound args", async () => {
    const tailrace = createTailrace();
    const post = tool({
      name: "post",
      description: "Post body",
      parameters: z.object({ body: z.string() }),
      execute: async () => "ok",
    });

    const wrapped = wrapTool(tailrace, post, { workflowId: "oai-w2" });
    await expect(wrapped.invoke({} as never, JSON.stringify({ body: FAKE_KEY }))).rejects.toThrow(
      /api_key/,
    );
  });

  it("wrapTools preserves array length", () => {
    const tailrace = createTailrace();
    const a = tool({
      name: "a",
      description: "a",
      parameters: z.object({}),
      execute: async () => "a",
    });
    const b = tool({
      name: "b",
      description: "b",
      parameters: z.object({}),
      execute: async () => "b",
    });
    const out = wrapTools(tailrace, [a, b], { workflowId: "oai-w3" });
    expect(out).toHaveLength(2);
    expect(out[0]?.name).toBe("a");
    expect(out[1]?.name).toBe("b");
  });
});

describe("withOpenAiAgents", () => {
  it("fluent tools wraps invoke", async () => {
    const t = withOpenAiAgents(createTailrace());
    const echo = tool({
      name: "echo",
      description: "echo email",
      parameters: z.object({ email: z.string() }),
      execute: async ({ email }) => email,
    });
    const [wrapped] = t.tools([echo], { workflowId: "oai-fluent" });
    const result = await wrapped!.invoke({} as never, JSON.stringify({ email: EMAIL }));
    expect(result).toMatch(/^<EMAIL_/);
  });
});
