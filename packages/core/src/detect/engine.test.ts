import { describe, expect, it } from "vitest";

import { createDetectionEngine } from "./engine";
import { NotImplementedError } from "../errors";
import type { Recognizer } from "../types";

describe("createDetectionEngine", () => {
  const engine = createDetectionEngine();

  it("detects a secret in a plain string", () => {
    // Built by concatenation so the assembled key never exists as a literal in the repo.
    const key = "sk_live_" + "C6Qc2MmKqcgowaGAyOQKG420";
    const spans = engine.detect(`use ${key} here`);
    expect(spans.some((s) => s.entity === "api_key")).toBe(true);
  });

  it("detects across object leaves and tags JSON-pointer paths", () => {
    const spans = engine.detect({
      profile: { email: "alice@example.com" },
      note: "no secrets",
    });
    const email = spans.find((s) => s.entity === "email");
    expect(email?.path).toBe("/profile/email");
  });

  it("excludes private IPs by default and includes them when configured", () => {
    expect(createDetectionEngine().detect("10.0.0.1")).toHaveLength(0);
    const withPrivate = createDetectionEngine({ includePrivateIps: true }).detect("10.0.0.1");
    expect(withPrivate.some((s) => s.entity === "ip_address")).toBe(true);
  });

  it("runs custom recognizers alongside (or instead of) the builtins", () => {
    const employeeId: Recognizer = {
      id: "employee-id",
      entities: ["employee_id"],
      tier: 0,
      scan: (text) => {
        const spans = [];
        const re = /EMP-\d{5}/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          spans.push({
            entity: "employee_id",
            start: m.index,
            end: m.index + m[0].length,
            confidence: 1,
            recognizer: "employee-id",
          });
        }
        return spans;
      },
    };
    const engineWithCustom = createDetectionEngine({
      recognizers: [employeeId],
      useBuiltins: false,
    });
    const spans = engineWithCustom.detect("ticket for EMP-01234");
    expect(spans).toEqual([expect.objectContaining({ entity: "employee_id" })]);
  });

  it("rejects async (Tier 1) recognizers until they are wired in a later milestone", () => {
    const asyncRecognizer: Recognizer = {
      id: "async",
      entities: ["person"],
      tier: 1,
      scan: () => Promise.resolve([]),
    };
    const engineWithAsync = createDetectionEngine({ recognizers: [asyncRecognizer] });
    expect(() => engineWithAsync.detect("anything")).toThrow(NotImplementedError);
  });
});
