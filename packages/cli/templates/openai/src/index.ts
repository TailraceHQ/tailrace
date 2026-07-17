/**
 * OpenAI Agents SDK + Tailrace tool wraps.
 *
 * `npm run verify` exercises block + tokenize without a network call.
 * `npm start` runs the agent (requires OPENAI_API_KEY).
 */

import { createTailrace } from "@tailrace/core";
import { withOpenAiAgents } from "@tailrace/openai-agents";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

const vaultKey = process.env["TAILRACE_VAULT_KEY"] ?? "demo-vault-key-not-for-prod";
const workflowId = process.env["TAILRACE_WORKFLOW_ID"] ?? "openai-agent";

const tailrace = withOpenAiAgents(
  createTailrace({
    vault: { key: vaultKey },
  }),
);

const lookupCustomer = tool({
  name: "lookup_customer",
  description: "Look up a customer by id; returns a synthetic contact email.",
  parameters: z.object({ customerId: z.string() }),
  execute: async ({ customerId }) => ({
    customerId,
    email: "customer@example.com",
  }),
});

const tools = tailrace.tools([lookupCustomer], {
  agent: "openai-agent",
  workflowId,
});

export const agent = new Agent({
  name: "Tailrace support agent",
  instructions:
    "You help with customer lookups. Use lookup_customer when asked. Never invent emails.",
  tools,
});

async function main(): Promise<void> {
  if (!process.env["OPENAI_API_KEY"]) {
    console.error("Set OPENAI_API_KEY to run the agent (or use: npm run verify)");
    process.exit(1);
  }

  const prompt =
    process.argv.slice(2).join(" ") ||
    "Look up customer cust_42 and draft a short reply to their email.";

  const result = await run(agent, prompt);
  console.log(result.finalOutput);
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("index.ts") || process.argv[1].endsWith("index.js"));

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
