import { expectTypeOf } from "expect-type";
import type { FunctionTool } from "@openai/agents";
import type { Tailrace } from "@tailrace/core";

import { wrapTools } from "./wrap-tools";

declare const tailrace: Tailrace;
declare const tools: [FunctionTool, FunctionTool];

const wrapped = wrapTools(tailrace, tools);
expectTypeOf(wrapped).toEqualTypeOf(tools);
