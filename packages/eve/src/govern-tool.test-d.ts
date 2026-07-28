import { expectTypeOf } from "expect-type";
import type { Tailrace } from "@tailrace/core";

import { governTool, governTools } from "./govern-tool";
import { withEve } from "./fluent";
import type { EveToolDefinition } from "./types";

declare const tailrace: Tailrace;

declare const crm: EveToolDefinition<{ query: string }, { ok: boolean }>;
declare const defs: {
  crm: EveToolDefinition<{ query: string }, { ok: boolean }>;
  search: EveToolDefinition<{ q: string }, string>;
};

const wrapped = governTool(tailrace, "crm", crm);
expectTypeOf(wrapped).toEqualTypeOf(crm);

const wrappedMap = governTools(tailrace, defs);
expectTypeOf(wrappedMap).toEqualTypeOf(defs);

const fluent = withEve(tailrace);
expectTypeOf(fluent.tool("crm", crm)).toEqualTypeOf(crm);
expectTypeOf(fluent.tools(defs)).toEqualTypeOf(defs);
