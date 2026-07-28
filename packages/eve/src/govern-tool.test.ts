import { createTailrace } from "@tailrace/core";
import { describe, expect, it } from "vitest";

import { withEve } from "./fluent";
import { governTool, governTools } from "./govern-tool";
import type { EveToolDefinition } from "./types";
import { resolveEveWorkflowId, sessionIdFromToolContext } from "./workflow-id";

const EMAIL = "user@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForFixturesOnly000FAKE";

function mockCtx(sessionId: string): { session: { id: string } } {
  return { session: { id: sessionId } };
}

describe("governTool / governTools", () => {
  it("tokenizes email in execute args", async () => {
    const tailrace = createTailrace();
    const crm: EveToolDefinition<{ email: string }, { email: string }> = {
      description: "Lookup customer",
      inputSchema: {},
      execute: async ({ email }) => {
        expect(email).not.toBe(EMAIL);
        expect(email).toMatch(/^<EMAIL_/);
        return { email };
      },
    };

    const wrapped = governTool(tailrace, "crm", crm, {
      workflowId: "eve-w1",
      agent: "support",
    });
    const result = await wrapped.execute({ email: EMAIL }, mockCtx("unused"));
    expect(result).toMatchObject({ email: expect.stringMatching(/^<EMAIL_/) });
  });

  it("blocks api_key in outbound args with value-free message", async () => {
    const tailrace = createTailrace();
    const post: EveToolDefinition<{ body: string }, string> = {
      description: "Post body",
      inputSchema: {},
      execute: async () => "ok",
    };

    const wrapped = governTool(tailrace, "post", post, { workflowId: "eve-w2" });
    await expect(wrapped.execute({ body: FAKE_KEY }, mockCtx("s"))).rejects.toThrow(/api_key/);
    try {
      await wrapped.execute({ body: FAKE_KEY }, mockCtx("s"));
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).not.toContain(FAKE_KEY);
    }
  });

  it("preserves object identity and Eve defineTool stamps (brand + definition key)", async () => {
    const tailrace = createTailrace();
    const BRAND = Symbol("TOOL_BRAND");
    const tool: EveToolDefinition<{ email: string }, string> = {
      description: "branded",
      inputSchema: {},
      execute: async ({ email }) => email,
    };
    // Mirror eve/tools defineTool: enumerable brand (Object.assign) + non-enumerable
    // definition key (Object.defineProperty, read during Eve agent resolution).
    Object.assign(tool, { [BRAND]: true });
    Object.defineProperty(tool, "__defKey", { configurable: true, value: "tool:branded" });

    const wrapped = governTool(tailrace, "branded", tool, { workflowId: "eve-brand" });

    // Same object: identity, prototype, and non-enumerable stamps survive.
    expect(wrapped).toBe(tool);
    expect((wrapped as unknown as Record<symbol, unknown>)[BRAND]).toBe(true);
    expect("__defKey" in wrapped).toBe(true);
    expect((wrapped as { __defKey?: string }).__defKey).toBe("tool:branded");

    // Still governs: the email tokenizes before reaching the original execute.
    const result = await wrapped.execute({ email: EMAIL }, mockCtx("s"));
    expect(result).toMatch(/^<EMAIL_/);
  });

  it("passthrough: tool without execute returned unchanged", () => {
    const tailrace = createTailrace();
    const bare = { description: "no execute", inputSchema: {} } as EveToolDefinition;
    const out = governTool(tailrace, "noop", bare);
    expect(out).toBe(bare);
  });

  it("workflowId from ctx.session.id is stable across calls", async () => {
    const tailrace = createTailrace();
    const tokens: string[] = [];
    const echo: EveToolDefinition<{ email: string }, string> = {
      description: "echo",
      inputSchema: {},
      execute: async ({ email }) => {
        tokens.push(email);
        return email;
      },
    };

    const wrapped = governTool(tailrace, "echo", echo, { agent: "support" });
    const ctx = mockCtx("eve-session-stable");
    await wrapped.execute({ email: EMAIL }, ctx);
    await wrapped.execute({ email: EMAIL }, ctx);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatch(/^<EMAIL_/);
    expect(tokens[0]).toBe(tokens[1]);
  });

  it("governTools wraps by key name", async () => {
    const tailrace = createTailrace();
    const a: EveToolDefinition<Record<string, never>, string> = {
      description: "a",
      inputSchema: {},
      execute: async () => "a",
    };
    const b: EveToolDefinition<Record<string, never>, string> = {
      description: "b",
      inputSchema: {},
      execute: async () => "b",
    };
    const out = governTools(tailrace, { a, b }, { workflowId: "eve-w3" });
    expect(Object.keys(out)).toEqual(["a", "b"]);
    expect(await out.a!.execute({}, mockCtx("s"))).toBe("a");
    expect(await out.b!.execute({}, mockCtx("s"))).toBe("b");
  });
});

describe("resolveEveWorkflowId", () => {
  it("prefers opts.workflowId over session", () => {
    expect(resolveEveWorkflowId({ workflowId: "explicit" }, mockCtx("session"))).toBe("explicit");
    expect(resolveEveWorkflowId({ workflowId: () => "fn" }, mockCtx("session"))).toBe("fn");
  });

  it("falls back to ctx.session.id", () => {
    expect(resolveEveWorkflowId(undefined, mockCtx("sess-1"))).toBe("sess-1");
    expect(sessionIdFromToolContext(mockCtx("sess-2"))).toBe("sess-2");
    expect(sessionIdFromToolContext(undefined)).toBeUndefined();
  });
});

describe("withEve", () => {
  it("fluent tool wraps execute", async () => {
    const t = withEve(createTailrace());
    const echo: EveToolDefinition<{ email: string }, string> = {
      description: "echo email",
      inputSchema: {},
      execute: async ({ email }) => email,
    };
    const wrapped = t.tool("echo", echo, { workflowId: "eve-fluent" });
    const result = await wrapped.execute({ email: EMAIL }, mockCtx("s"));
    expect(result).toMatch(/^<EMAIL_/);
  });
});
