/**
 * wrapTools unit tests.
 */

import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { wrapTools } from "./wrap-tools";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "tool@example.com";

describe("wrapTools", () => {
  it("tokenizes email in tool args (out) and result (in)", async () => {
    const seenArgs: unknown[] = [];
    const tools = {
      crm: tool({
        description: "crm",
        inputSchema: z.object({ email: z.string() }),
        execute: async (args) => {
          seenArgs.push(args);
          return { echo: args.email, note: `got ${EMAIL}` };
        },
      }),
    } satisfies ToolSet;

    const tailrace = createTailrace({ vault: memoryVault({ key: "tools" }) });
    const wrapped = wrapTools(tailrace, tools, { workflowId: "tw1", agent: "support" });
    const result = await wrapped.crm.execute!(
      { email: EMAIL },
      {
        toolCallId: "1",
        messages: [],
      },
    );

    expect(seenArgs[0]).toMatchObject({
      email: expect.stringMatching(/<[A-Z0-9_]+_[a-z0-9]{8}>/),
    });
    expect(JSON.stringify(seenArgs[0])).not.toContain(EMAIL);
    expect(JSON.stringify(result)).not.toContain(EMAIL);
  });

  it("returns formatted tool error string on block", async () => {
    const tools = {
      ship: tool({
        description: "ship",
        inputSchema: z.object({ key: z.string() }),
        execute: async () => ({ ok: true }),
      }),
    } satisfies ToolSet;

    const tailrace = createTailrace({ vault: memoryVault({ key: "tools-block" }) });
    const wrapped = wrapTools(tailrace, tools, { workflowId: "tw2" });
    await expect(
      wrapped.ship.execute!({ key: SECRET }, { toolCallId: "1", messages: [] }),
    ).rejects.toThrow(/Blocked by data policy: api_key/);
  });

  it("passes through tools without execute", () => {
    const tools = {
      schemaOnly: tool({
        description: "no exec",
        inputSchema: z.object({ x: z.string() }),
      }),
    } satisfies ToolSet;
    const tailrace = createTailrace({ vault: memoryVault({ key: "tools-pass" }) });
    const wrapped = wrapTools(tailrace, tools);
    expect(wrapped.schemaOnly.execute).toBeUndefined();
  });
});
