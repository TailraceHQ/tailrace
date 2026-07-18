import { describe, expect, it, vi } from "vitest";

import { createDetectionEngine } from "./engine";
import { definePatternRecognizer } from "./pattern-recognizer";
import { RecognizerError } from "../errors";
import type { Recognizer } from "../types";

describe("createDetectionEngine", () => {
  const engine = createDetectionEngine();

  it("detects a secret in a plain string", async () => {
    // Built by concatenation so the assembled key never exists as a literal in the repo.
    const key = "sk_live_" + "C6Qc2MmKqcgowaGAyOQKG420";
    const spans = await engine.detect(`use ${key} here`);
    expect(spans.some((s) => s.entity === "api_key")).toBe(true);
  });

  it("detects across object leaves and tags JSON-pointer paths", async () => {
    const spans = await engine.detect({
      profile: { email: "alice@example.com" },
      note: "no secrets",
    });
    const email = spans.find((s) => s.entity === "email");
    expect(email?.path).toBe("/profile/email");
  });

  it("excludes private IPs by default and includes them when configured", async () => {
    expect(await createDetectionEngine().detect("10.0.0.1")).toHaveLength(0);
    const withPrivate = await createDetectionEngine({ includePrivateIps: true }).detect("10.0.0.1");
    expect(withPrivate.some((s) => s.entity === "ip_address")).toBe(true);
  });

  it("runs custom recognizers alongside (or instead of) the builtins", async () => {
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
    const spans = await engineWithCustom.detect("ticket for EMP-01234");
    expect(spans).toEqual([expect.objectContaining({ entity: "employee_id" })]);
  });

  it("awaits async (Tier 1) recognizers and merges their spans", async () => {
    const asyncRecognizer: Recognizer = {
      id: "async-ner",
      entities: ["person"],
      tier: 1,
      scan: async (text) => {
        const idx = text.indexOf("Alice");
        if (idx < 0) return [];
        return [
          {
            entity: "person",
            start: idx,
            end: idx + "Alice".length,
            confidence: 0.9,
            recognizer: "async-ner",
          },
        ];
      },
    };
    const engineWithAsync = createDetectionEngine({
      recognizers: [asyncRecognizer],
      useBuiltins: false,
    });
    const spans = await engineWithAsync.detect("hello Alice");
    expect(spans).toEqual([expect.objectContaining({ entity: "person", start: 6, end: 11 })]);
  });

  it("skips a rejected Tier 1 recognizer (fail open) and continues others", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const good = definePatternRecognizer({
      id: "good",
      entity: "employee_id",
      tier: 0,
      patterns: [{ source: "EMP-\\d{5}" }],
    });
    const badAsync: Recognizer = {
      id: "bad-async",
      entities: ["person"],
      tier: 1,
      scan: async () => {
        throw new Error("model missing");
      },
    };
    const engineWithBoth = createDetectionEngine({
      recognizers: [badAsync, good],
      useBuiltins: false,
    });
    const spans = await engineWithBoth.detect("EMP-01234");
    expect(spans.some((s) => s.entity === "employee_id")).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("rejects duplicate recognizer ids", () => {
    const a = definePatternRecognizer({
      id: "dup",
      entity: "employee_id",
      tier: 0,
      patterns: [{ source: "EMP" }],
    });
    const b = definePatternRecognizer({
      id: "dup",
      entity: "ticket_id",
      tier: 0,
      patterns: [{ source: "TKT" }],
    });
    expect(() => createDetectionEngine({ recognizers: [a, b], useBuiltins: false })).toThrow(
      RecognizerError,
    );
  });

  it("skips a throwing custom recognizer and continues others", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const good = definePatternRecognizer({
      id: "good",
      entity: "employee_id",
      tier: 0,
      patterns: [{ source: "EMP-\\d{5}" }],
    });
    const bad: Recognizer = {
      id: "bad",
      entities: ["broken"],
      tier: 0,
      scan: () => {
        throw new Error("boom");
      },
    };
    const eng = createDetectionEngine({ recognizers: [bad, good], useBuiltins: false });
    const spans = await eng.detect("EMP-01234");
    expect(spans.some((s) => s.entity === "employee_id")).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
