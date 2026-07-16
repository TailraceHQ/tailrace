import { expectTypeOf } from "expect-type";

import { wrapToolExecute } from "./wrap-tool-execute";
import type { Tailrace } from "@tailrace/core";

declare const tailrace: Tailrace;

const original = async (args: { id: string }) => args.id;
const wrapped = wrapToolExecute(tailrace, "crm", original);

expectTypeOf(wrapped).parameters.toEqualTypeOf<[args: { id: string }, ...rest: unknown[]]>();
expectTypeOf(wrapped).returns.toEqualTypeOf<Promise<string>>();
