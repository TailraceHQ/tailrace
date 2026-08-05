import { describe, expect, it } from "vitest";
import {
  compilePlaygroundRecognizers,
  runPlaygroundScan,
  type PlaygroundCustomPattern,
  type PlaygroundToggleEntity,
} from "./playground-scan";
import type { Action } from "@tailrace/core";

const DEFAULT_ACTIONS: Record<PlaygroundToggleEntity, Action> = {
  api_key: "block",
  jwt: "block",
  private_key: "block",
  high_entropy_secret: "block",
  connection_string: "block",
  email: "tokenize",
  phone: "tokenize",
  credit_card: "tokenize",
  iban: "tokenize",
  ssn: "tokenize",
  ip_address: "allow",
  url_credentials: "block",
};

const EMPLOYEE_PATTERN: PlaygroundCustomPattern = {
  id: "custom-1",
  entity: "employee_id",
  source: String.raw`\bEMP-\d{5}\b`,
  confidence: "1",
  action: "tokenize",
};

describe("playground custom pattern flow (M6e)", () => {
  it("add pattern → scan sample → token in output", async () => {
    const { recognizers, errors } = compilePlaygroundRecognizers([EMPLOYEE_PATTERN]);
    expect(errors).toEqual({});
    expect(recognizers).toHaveLength(1);

    const text = "Assign ticket EMP-01234 to Alice";
    const result = await runPlaygroundScan({
      text,
      actions: DEFAULT_ACTIONS,
      customPatterns: [EMPLOYEE_PATTERN],
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.output).not.toContain("EMP-01234");
    expect(result.output).toMatch(/<EMPLOYEE_ID_[a-z0-9]{8}>/);
    expect(
      result.decisions.some((d) => d.entity === "employee_id" && d.action === "tokenize"),
    ).toBe(true);
  });

  it("rejects unsafe draft patterns at compile time without throwing from scan", async () => {
    const evil: PlaygroundCustomPattern = {
      id: "custom-evil",
      entity: "evil_id",
      source: "(a+)+",
      confidence: "1",
      action: "tokenize",
    };
    const { recognizers, errors } = compilePlaygroundRecognizers([evil]);
    expect(recognizers).toHaveLength(0);
    expect(errors["custom-evil"]).toBeTruthy();

    const result = await runPlaygroundScan({
      text: "aaaa",
      actions: DEFAULT_ACTIONS,
      customPatterns: [evil],
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.output).toBe("aaaa");
    expect(result.decisions.some((d) => d.entity === "evil_id")).toBe(false);
  });
});
