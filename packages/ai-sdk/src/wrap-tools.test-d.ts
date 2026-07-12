/**
 * Type-level: wrapped tools preserve generics (expect-type).
 */

import { expectTypeOf } from "expect-type";
import type { Tailrace } from "@tailrace/core";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { wrapTools } from "./wrap-tools";

declare const tailrace: Tailrace;

const tools = {
  crm: tool({
    description: "crm",
    inputSchema: z.object({ email: z.string() }),
    execute: async (args) => ({ ok: true as const, email: args.email }),
  }),
} satisfies ToolSet;

const wrapped = wrapTools(tailrace, tools);

expectTypeOf(wrapped).toEqualTypeOf(tools);
expectTypeOf(wrapped.crm).toEqualTypeOf(tools.crm);
