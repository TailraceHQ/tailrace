/**
 * Type-level smoke: procedure.use accepts createTailraceMiddleware.
 */

import { expectTypeOf } from "expect-type";
import { createTailrace } from "@tailrace/core";
import { initTRPC } from "@trpc/server";

import { createTailraceMiddleware, withTrpc } from "./index";

const t = initTRPC.create();
const mw = createTailraceMiddleware(createTailrace(), { agent: "api" });
const procedure = t.procedure.use(mw);
expectTypeOf(procedure).not.toBeNever();

const tr = withTrpc(createTailrace());
expectTypeOf(tr.middleware).toBeFunction();
const procedure2 = t.procedure.use(tr.middleware({ agent: "api" }));
expectTypeOf(procedure2).not.toBeNever();
