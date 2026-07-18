/**
 * tRPC procedure middleware: input block, output tokenize.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTailraceMiddleware, withTrpc } from "./index";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "trpc@example.com";

describe("createTailraceMiddleware", () => {
  it("blocks secret in procedure input", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "trpc-in-secret" }) });
    const t = initTRPC.create();
    const procedure = t.procedure
      .input(z.object({ note: z.string() }))
      .use(createTailraceMiddleware(tailrace, { agent: "api" }))
      .query(({ input }) => input);

    const caller = t.router({ echo: procedure }).createCaller({});
    await expect(caller.echo({ note: `use ${SECRET}` })).rejects.toBeInstanceOf(TRPCError);
    try {
      await caller.echo({ note: `use ${SECRET}` });
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      const e = err as TRPCError;
      expect(e.code).toBe("BAD_REQUEST");
      expect(e.message).toMatch(/api_key/);
      expect(e.message).not.toContain(SECRET);
    }
  });

  it("tokenizes email in procedure output", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "trpc-out-email" }) });
    const t = initTRPC.create();
    const procedure = t.procedure
      .use(createTailraceMiddleware(tailrace, { agent: "api", workflowId: "w1" }))
      .query(() => ({ contact: EMAIL }));

    const caller = t.router({ get: procedure }).createCaller({});
    const result = await caller.get();
    expect(result.contact).not.toContain(EMAIL);
    expect(result.contact).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });

  it("tokenizes email in procedure input", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "trpc-in-email" }) });
    const t = initTRPC.create();
    let seen: string | undefined;
    const procedure = t.procedure
      .input(z.object({ note: z.string() }))
      .use(createTailraceMiddleware(tailrace, { agent: "api", workflowId: "w2" }))
      .mutation(({ input }) => {
        seen = input.note;
        return { ok: true as const };
      });

    const caller = t.router({ save: procedure }).createCaller({});
    await caller.save({ note: `hello ${EMAIL}` });
    expect(seen).toBeDefined();
    expect(seen).not.toContain(EMAIL);
    expect(seen).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
  });
});

describe("withTrpc", () => {
  it("exposes fluent middleware helper", async () => {
    const tr = withTrpc(createTailrace({ vault: memoryVault({ key: "trpc-fluent" }) }));
    const t = initTRPC.create();
    const procedure = t.procedure
      .use(tr.middleware({ agent: "api", workflowId: "w3" }))
      .query(() => ({ contact: EMAIL }));
    const caller = t.router({ get: procedure }).createCaller({});
    const result = await caller.get();
    expect(result.contact).not.toContain(EMAIL);
  });
});
