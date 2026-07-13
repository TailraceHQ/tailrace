/**
 * Type-level: wrapTransport preserves the transport generic (expect-type).
 */

import { expectTypeOf } from "expect-type";
import type { Tailrace } from "@tailrace/core";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { wrapTransport } from "./wrap-transport";
import { withMcp } from "./fluent";

declare const tailrace: Tailrace;
declare const transport: Transport;

const wrapped = wrapTransport(tailrace, transport, { server: "salesforce" });
expectTypeOf(wrapped).toEqualTypeOf(transport);

const fluent = withMcp(tailrace);
expectTypeOf(fluent.transport(transport, { server: "s" })).toEqualTypeOf(transport);
