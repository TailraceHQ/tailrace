/**
 * Templates for `tailrace init`.
 */

export type DetectedStack = "ai-sdk" | "next" | "hono" | "node";

export function detectStack(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): DetectedStack {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  // next implies AI SDK path often; prefer next when both present for snippet.
  if (deps.next !== undefined) return "next";
  if (deps.ai !== undefined) return "ai-sdk";
  if (deps.hono !== undefined) return "hono";
  return "node";
}

export function configTsTemplate(): string {
  return `import { createTailrace, definePatternRecognizer, definePolicy } from "@tailrace/core";

// Zero-config: secrets → block, common PII → tokenize.
// Customize with definePolicy({ entities: { email: "tokenize", api_key: "block" } })
// and pass { policy } to createTailrace.
// Policy JSON Schema: https://tailrace.dev/schema/policy.v1.json

// Optional custom pattern recognizer (app runtime; Claude Code hook uses .tailrace/config.json):
// const employeeId = definePatternRecognizer({
//   id: "employee-id",
//   entity: "employee_id",
//   tier: 0,
//   patterns: [{ source: String.raw\`\\\\bEMP-\\\\d{5}\\\\b\`, confidence: 1 }],
// });
// export const tailrace = createTailrace({
//   recognizers: [employeeId],
//   policy: definePolicy({ entities: { employee_id: "tokenize" }, defaults: { action: "allow" } }),
// });

export const tailrace = createTailrace();
`;
}

export function integrationSnippet(stack: DetectedStack): string {
  switch (stack) {
    case "ai-sdk":
    case "next":
      return `import { withAiSdk } from "@tailrace/ai-sdk";
import { tailrace as base } from "./tailrace.config";
const tailrace = withAiSdk(base);
// const model = tailrace.model(openai("gpt-4o"));`;
    case "hono":
      return `import { tailraceHono } from "@tailrace/hono";
import { tailrace } from "./tailrace.config";
// app.use("/v1/*", tailraceHono(tailrace));`;
    case "node":
      return `// Claude Code: run \`tailrace install-hooks\` to wire PreToolUse / PostToolUse.
// App code: import { tailrace } from "./tailrace.config";
// MCP: import { withMcp } from "@tailrace/mcp";`;
  }
}

export function randomVaultKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}
