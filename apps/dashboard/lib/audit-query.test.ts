import { describe, expect, it } from "vitest";

import {
  AuditQueryError,
  DEFAULT_AUDIT_LIMIT,
  MAX_AUDIT_LIMIT,
  parseAuditQuery,
} from "./audit-query";

describe("parseAuditQuery", () => {
  it("defaults limit when omitted", () => {
    const q = parseAuditQuery(new URLSearchParams());
    expect(q.limit).toBe(DEFAULT_AUDIT_LIMIT);
    expect(q.offset).toBe(0);
  });

  it("caps limit at MAX_AUDIT_LIMIT", () => {
    const q = parseAuditQuery(new URLSearchParams({ limit: "99999" }));
    expect(q.limit).toBe(MAX_AUDIT_LIMIT);
  });

  it("rejects NaN / non-integer limit with AuditQueryError", () => {
    expect(() => parseAuditQuery(new URLSearchParams({ limit: "abc" }))).toThrow(AuditQueryError);
    expect(() => parseAuditQuery(new URLSearchParams({ limit: "-1" }))).toThrow(AuditQueryError);
    expect(() => parseAuditQuery(new URLSearchParams({ limit: "1.5" }))).toThrow(AuditQueryError);
    expect(() => parseAuditQuery(new URLSearchParams({ limit: "0" }))).toThrow(
      /limit must be >= 1/,
    );
  });

  it("rejects invalid offset", () => {
    expect(() => parseAuditQuery(new URLSearchParams({ offset: "nope" }))).toThrow(AuditQueryError);
  });
});
