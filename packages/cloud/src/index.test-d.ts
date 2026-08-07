import { expectTypeOf } from "expect-type";
import type { AuditSink, PolicySource } from "@tailrace/core";

import { remoteAuditSink, remotePolicy } from "./index";

expectTypeOf(remotePolicy).returns.toEqualTypeOf<PolicySource>();
expectTypeOf(remoteAuditSink).returns.toEqualTypeOf<AuditSink>();
