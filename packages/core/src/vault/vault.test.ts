/**
 * Vault tokenization, alphabet/restore alignment, encrypted-at-rest, and property tests.
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import type { KvStore } from "../types";
import {
  TOKEN_ID_ALPHABET,
  TOKEN_ID_CHAR_CLASS,
  TOKEN_ID_LENGTH,
  bytesToTokenId,
} from "./alphabet";
import { decryptAtRest, resolveMasterKey } from "./crypto";
import { kvVault } from "./kv";
import { memoryVault } from "./memory";
import { storageKey } from "./shared";
import {
  LABEL_RE,
  deriveTokenId,
  deriveWorkflowKey,
  formatToken,
  labelToken,
  normalizeValue,
} from "./token";

const MASTER = "test-master-key-not-a-secret";

function memoryKv(): KvStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    async get(key) {
      return raw.get(key) ?? null;
    },
    async put(key, value) {
      raw.set(key, value);
    },
    async delete(key) {
      raw.delete(key);
    },
  };
}

describe("token-id alphabet", () => {
  it("generation alphabet matches restore LABEL_RE character class", () => {
    const idRe = new RegExp(`^${TOKEN_ID_CHAR_CLASS}{${TOKEN_ID_LENGTH}}$`);
    for (const ch of TOKEN_ID_ALPHABET) {
      expect(ch).toMatch(new RegExp(`^${TOKEN_ID_CHAR_CLASS}$`));
    }
    // Synthetic id containing a digit that RFC 4648 base32 cannot emit (e.g. 9).
    const withNine = "a3f2k9qx";
    expect(withNine).toMatch(idRe);
    LABEL_RE.lastIndex = 0;
    expect(LABEL_RE.test(`<EMAIL_${withNine}>`)).toBe(true);
  });

  it("bytesToTokenId only emits alphabet characters", () => {
    const id = bytesToTokenId(new Uint8Array(32).fill(0xff));
    expect(id).toHaveLength(TOKEN_ID_LENGTH);
    for (const ch of id) {
      expect(TOKEN_ID_ALPHABET.includes(ch)).toBe(true);
    }
  });
});

describe("token derivation", () => {
  it("is deterministic for the same workflow/entity/value", async () => {
    const master = resolveMasterKey(MASTER);
    const wk = await deriveWorkflowKey(master, "wf-1");
    const a = await deriveTokenId(wk, "email", normalizeValue("email", "User@Example.com"));
    const b = await deriveTokenId(wk, "email", normalizeValue("email", "user@example.com"));
    expect(a).toBe(b);
    expect(a).toMatch(new RegExp(`^${TOKEN_ID_CHAR_CLASS}{${TOKEN_ID_LENGTH}}$`));
  });

  it("differs across workflows", async () => {
    const master = resolveMasterKey(MASTER);
    const a = await deriveTokenId(
      await deriveWorkflowKey(master, "wf-a"),
      "email",
      "user@example.com",
    );
    const b = await deriveTokenId(
      await deriveWorkflowKey(master, "wf-b"),
      "email",
      "user@example.com",
    );
    expect(a).not.toBe(b);
  });

  it("property: token determinism over workflow/entity/value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 48 }),
        fc.constantFrom("email", "phone", "ssn", "iban", "credit_card"),
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 48 }),
        async (workflowId, entity, value, otherWorkflow) => {
          const master = resolveMasterKey(MASTER);
          const wk = await deriveWorkflowKey(master, workflowId);
          const normalized = normalizeValue(entity, value);
          const a = await deriveTokenId(wk, entity, normalized);
          const b = await deriveTokenId(wk, entity, normalized);
          expect(a).toBe(b);
          expect(a).toHaveLength(TOKEN_ID_LENGTH);
          for (const ch of a) {
            expect(TOKEN_ID_ALPHABET.includes(ch)).toBe(true);
          }
          // Label form must be matchable by LABEL_RE (generation ↔ restore).
          LABEL_RE.lastIndex = 0;
          expect(LABEL_RE.test(labelToken(entity, a))).toBe(true);

          if (otherWorkflow !== workflowId) {
            const other = await deriveTokenId(
              await deriveWorkflowKey(master, otherWorkflow),
              entity,
              normalized,
            );
            expect(other).not.toBe(a);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe("format-preserving tokens", () => {
  it("email uses redacted.example", () => {
    const token = formatToken("email", "abcdefgh", "preserve", "a@b.com");
    expect(token).toBe("abcdefgh@redacted.example");
  });

  it("phone uses +1555 prefix", () => {
    const token = formatToken("phone", "abcdefgh", "preserve", "+1 (555) 010-9999");
    expect(token.startsWith("+1555")).toBe(true);
    expect(token).toMatch(/^\+1555\d{7}$/);
  });
});

describe("memoryVault", () => {
  it("round-trips put/get", async () => {
    const vault = memoryVault({ key: MASTER });
    await vault.put({
      workflowId: "w",
      token: "<EMAIL_abcdefgh>",
      entity: "email",
      value: "user@example.com",
    });
    const got = await vault.get("w", "<EMAIL_abcdefgh>");
    expect(got).toEqual({ entity: "email", value: "user@example.com" });
  });

  it("purge removes workflow entries", async () => {
    const vault = memoryVault({ key: MASTER });
    await vault.put({
      workflowId: "w",
      token: "<EMAIL_abcdefgh>",
      entity: "email",
      value: "user@example.com",
    });
    await vault.purge("w");
    expect(await vault.get("w", "<EMAIL_abcdefgh>")).toBeNull();
  });
});

describe("kvVault encrypted at rest", () => {
  it("stores ciphertext that does not contain the plaintext value", async () => {
    const kv = memoryKv();
    const vault = kvVault(kv, { key: MASTER });
    const value = "user@example.com";
    const token = "<EMAIL_testhash>";
    await vault.put({
      workflowId: "w",
      token,
      entity: "email",
      value,
    });
    const raw = kv.raw.get(storageKey("w", token));
    expect(raw).toBeDefined();
    expect(raw!.includes(value)).toBe(false);
    expect(raw!.includes("user")).toBe(false);
    expect(await vault.get("w", token)).toEqual({ entity: "email", value });
    const parsed = JSON.parse(raw!) as { ciphertext: string };
    const plain = await decryptAtRest(resolveMasterKey(MASTER), parsed.ciphertext);
    expect(plain).toBe(value);
  });
});

describe("compile-time format:preserve warning", () => {
  it("warns for unsupported entities at compilePolicy", async () => {
    const { compilePolicy } = await import("../policy/compile");
    const warn = vi.fn();
    const spy = vi.spyOn(console, "warn").mockImplementation(warn);
    compilePolicy({
      entities: {
        ssn: { action: "tokenize", format: "preserve" },
        email: { action: "tokenize", format: "preserve" },
      },
    });
    spy.mockRestore();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("ssn"))).toBe(true);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('"email"'))).toBe(false);
  });
});
