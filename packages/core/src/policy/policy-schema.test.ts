/**
 * Published policy JSON Schema must reject invalid documents (machine-readable.md §3).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../schemas/policy.v1.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as object;

describe("policy.v1.json schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  it("accepts a minimal valid policy", () => {
    expect(
      validate({
        $schema: "https://tailrace.dev/schema/policy.v1.json",
        entities: { email: "tokenize", api_key: "block" },
      }),
    ).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(validate({ entities: { email: "yeet" } })).toBe(false);
    expect(validate.errors?.some((e) => e.message?.includes("must be equal to one of the allowed values"))).toBe(
      true,
    );
  });

  it("rejects extra top-level keys", () => {
    expect(validate({ entities: { email: "allow" }, notAField: true })).toBe(false);
  });
});
