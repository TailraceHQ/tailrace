import { describe, expect, it } from "vitest";

import {
  apiKeyRecognizer,
  connectionStringRecognizer,
  highEntropySecretRecognizer,
  jwtRecognizer,
  privateKeyRecognizer,
} from "./secrets";
import type { Recognizer, Span } from "../../types";

/** Tier 0 recognizers are synchronous; unwrap the union for assertions. */
function run(recognizer: Recognizer, text: string): Span[] {
  const out = recognizer.scan(text);
  if (out instanceof Promise) throw new Error("expected a synchronous Tier 0 recognizer");
  return out;
}

describe("apiKeyRecognizer", () => {
  it("detects Stripe secret keys (assembled at runtime, not committed as a literal)", () => {
    const live = "sk_live_" + "51H8xFAKEabcdefghijklmno";
    const test = "sk_test_" + "51H8xFAKEabcdefghijklmno";
    expect(run(apiKeyRecognizer, `key=${live}`)).toHaveLength(1);
    expect(run(apiKeyRecognizer, `key=${test}`)).toHaveLength(1);
  });

  it("detects Slack tokens (assembled at runtime)", () => {
    const token = "xoxb" + "-826062040408-" + "xEsmWKAkFAKE6U6YOiUa";
    expect(run(apiKeyRecognizer, `slack ${token}`).some((s) => s.entity === "api_key")).toBe(true);
  });

  it("marks Stripe publishable keys as api_key but low-confidence", () => {
    const pub = "pk_live_" + "51H8xFAKEabcdefghijklmno";
    const [span] = run(apiKeyRecognizer, pub);
    expect(span?.confidence).toBe(0.8);
  });

  it("does not match short or prefix-only strings", () => {
    expect(run(apiKeyRecognizer, "sk-short and sk_live_tooshort")).toHaveLength(0);
  });
});

describe("jwtRecognizer", () => {
  it("accepts a token whose header decodes to a valid JWT header", () => {
    // header {"alg":"HS256","typ":"JWT"}
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhIn0.c2ln";
    expect(run(jwtRecognizer, jwt)).toHaveLength(1);
  });

  it("drops a 3-segment token whose header is not valid JSON", () => {
    expect(run(jwtRecognizer, "eyJABCDEFGHIJK.notreal.signature")).toHaveLength(0);
  });
});

describe("privateKeyRecognizer", () => {
  it("matches a full PEM block and a lone BEGIN marker", () => {
    const block = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEE\n-----END EC PRIVATE KEY-----";
    expect(run(privateKeyRecognizer, block)).toHaveLength(1);
    expect(run(privateKeyRecognizer, "-----BEGIN OPENSSH PRIVATE KEY-----")).toHaveLength(1);
  });

  it("ignores public keys and certificates", () => {
    expect(run(privateKeyRecognizer, "-----BEGIN PUBLIC KEY-----")).toHaveLength(0);
    expect(run(privateKeyRecognizer, "-----BEGIN CERTIFICATE-----")).toHaveLength(0);
  });
});

describe("highEntropySecretRecognizer", () => {
  it("flags a high-entropy token in keyword context", () => {
    expect(
      run(highEntropySecretRecognizer, "API_SECRET=K4co8JmxGbXdEumoC5zCNtZuy4oPgJD4"),
    ).toHaveLength(1);
  });

  it("ignores the same token with no keyword/assignment context", () => {
    expect(
      run(highEntropySecretRecognizer, "value K4co8JmxGbXdEumoC5zCNtZuy4oPgJD4 here"),
    ).toHaveLength(0);
  });

  it("ignores lowercase-hex hashes (fails the base62 charset gate)", () => {
    expect(
      run(highEntropySecretRecognizer, "token e3b0c44298fc1c149afbf4c8996fb92427ae41e4"),
    ).toHaveLength(0);
  });
});

describe("connectionStringRecognizer", () => {
  it("matches DSN URIs with userinfo and ADO-style strings with a password", () => {
    expect(
      run(connectionStringRecognizer, "postgres://u:pFAKE@db.example.com:5432/app"),
    ).toHaveLength(1);
    expect(
      run(connectionStringRecognizer, "Server=db.example.com;Database=app;Password=pFAKE;"),
    ).toHaveLength(1);
  });

  it("ignores a DSN scheme without credentials", () => {
    expect(run(connectionStringRecognizer, "postgresql://localhost/mydb")).toHaveLength(0);
  });
});
