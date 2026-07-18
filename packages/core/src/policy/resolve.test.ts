/**
 * Property-based and unit tests for policy resolution precedence.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { definePolicy, NotImplementedError, PolicyValidationError } from "../index";
import type { Action, Boundary, Identity, PolicyDocument } from "../types";
import { compilePolicy } from "./compile";
import { defaultPolicy } from "./default";
import { resolve } from "./resolve";
import { validatePolicy } from "./validate";

const modelBoundary: Boundary = { kind: "model", provider: "openai/gpt-4o" };
const identity: Identity = { agent: "default" };

describe("defaultPolicy", () => {
  it("blocks secrets and tokenizes email", () => {
    const compiled = compilePolicy(defaultPolicy());
    expect(resolve(compiled, "api_key", modelBoundary, identity).action).toBe("block");
    expect(resolve(compiled, "secret", modelBoundary, identity).action).toBe("block");
    expect(resolve(compiled, "email", modelBoundary, identity).action).toBe("tokenize");
    expect(resolve(compiled, "person", modelBoundary, identity).action).toBe("allow");
    expect(resolve(compiled, "account_number", modelBoundary, identity).action).toBe("allow");
  });

  it("allows ip_address and blocks url_credentials explicitly", () => {
    const compiled = compilePolicy(defaultPolicy());
    expect(resolve(compiled, "ip_address", modelBoundary, identity).action).toBe("allow");
    expect(resolve(compiled, "url_credentials", modelBoundary, identity).action).toBe("block");
  });

  it("tokenizes common structured PII but not every PiiEntityClass", () => {
    const compiled = compilePolicy(defaultPolicy());
    for (const entity of ["email", "phone", "credit_card", "iban", "ssn"] as const) {
      expect(resolve(compiled, entity, modelBoundary, identity).action).toBe("tokenize");
    }
  });

  it("detokenizes at egress sinks", () => {
    const compiled = compilePolicy(defaultPolicy());
    const egress: Boundary = { kind: "egress", sink: "ui" };
    expect(resolve(compiled, "email", egress, identity).action).toBe("detokenize");
  });
});

describe("definePolicy / validatePolicy", () => {
  it("rejects review at compile time", () => {
    expect(() => definePolicy({ entities: { email: "review" } })).toThrow(NotImplementedError);
  });

  it("rejects detokenize outside egress", () => {
    expect(() => definePolicy({ entities: { email: "detokenize" } })).toThrow(
      PolicyValidationError,
    );
  });

  it("allows detokenize under egress keys", () => {
    expect(() =>
      definePolicy({
        boundaries: { "egress:ui": { entities: { email: "detokenize" } } },
      }),
    ).not.toThrow();
  });
});

describe("resolve precedence", () => {
  it("identity boundary beats identity entity beats top boundary beats top entity", () => {
    const doc: PolicyDocument = {
      defaults: { action: "allow" },
      entities: { email: "mask" },
      boundaries: {
        "openai/*": { entities: { email: "tokenize" } },
      },
      identities: {
        support: {
          entities: { email: "block" },
          boundaries: {
            "openai/*": { entities: { email: "allow" } },
          },
        },
      },
      dangerouslyAllowSecrets: true,
    };
    validatePolicy(doc);
    const compiled = compilePolicy(doc);
    const support: Identity = { agent: "support" };
    expect(resolve(compiled, "email", modelBoundary, support).action).toBe("allow");
    expect(resolve(compiled, "email", modelBoundary, identity).action).toBe("tokenize");
  });

  it("exact boundary key beats glob", () => {
    const doc: PolicyDocument = {
      entities: { email: "allow" },
      boundaries: {
        "openai/*": { entities: { email: "mask" } },
        "openai/gpt-4o": { entities: { email: "tokenize" } },
      },
    };
    const compiled = compilePolicy(doc);
    expect(resolve(compiled, "email", modelBoundary, identity).action).toBe("tokenize");
  });

  it("model globs do not match prefixed tool keys", () => {
    const doc: PolicyDocument = {
      entities: { email: "allow" },
      boundaries: {
        "openai/*": { entities: { email: "tokenize" } },
        "tool:openai/*:out": { entities: { email: "block" } },
      },
    };
    const compiled = compilePolicy(doc);
    const toolBoundary: Boundary = { kind: "tool", name: "openai/fetch", direction: "out" };
    expect(resolve(compiled, "email", toolBoundary, identity).action).toBe("block");
    expect(resolve(compiled, "email", modelBoundary, identity).action).toBe("tokenize");
  });

  it("model globs do not match prefixed mcp keys", () => {
    const doc: PolicyDocument = {
      entities: { email: "allow" },
      boundaries: {
        "openai/*": { entities: { email: "tokenize" } },
        "mcp:openai/*": { entities: { email: "mask" } },
      },
    };
    const compiled = compilePolicy(doc);
    const mcpBoundary: Boundary = {
      kind: "mcp",
      server: "openai",
      tool: "search",
      direction: "out",
    };
    expect(resolve(compiled, "email", mcpBoundary, identity).action).toBe("mask");
  });

  it("secrets-cannot-be-allowed without dangerouslyAllowSecrets", () => {
    const doc: PolicyDocument = {
      entities: { api_key: "block" },
      identities: {
        admin: { entities: { api_key: "allow" } },
      },
    };
    const compiled = compilePolicy(doc);
    expect(resolve(compiled, "api_key", modelBoundary, { agent: "admin" }).action).toBe("block");
  });

  it("allows secret override with dangerouslyAllowSecrets on the rule", () => {
    const doc: PolicyDocument = {
      entities: { api_key: "block" },
      identities: {
        admin: {
          entities: { api_key: { action: "allow", dangerouslyAllowSecrets: true } },
        },
      },
    };
    const compiled = compilePolicy(doc);
    expect(resolve(compiled, "api_key", modelBoundary, { agent: "admin" }).action).toBe("allow");
  });

  it("property: more-specific identity entity beats top-level entity", () => {
    const actions = ["allow", "mask", "tokenize", "block"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...actions), fc.constantFrom(...actions), (top, idAction) => {
        const doc: PolicyDocument = {
          entities: { phone: top },
          identities: {
            "agent-a": { entities: { phone: idAction } },
          },
        };
        const compiled = compilePolicy(doc);
        const result = resolve(compiled, "phone", modelBoundary, { agent: "agent-a" });
        expect(result.action).toBe(idAction);
      }),
      { numRuns: 40 },
    );
  });

  it("property: defaults apply when nothing else matches", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("allow", "mask", "tokenize", "block") as fc.Arbitrary<Action>,
        (def) => {
          const compiled = compilePolicy({ defaults: { action: def } });
          expect(resolve(compiled, "organization", modelBoundary, identity).action).toBe(def);
        },
      ),
      { numRuns: 20 },
    );
  });
});
