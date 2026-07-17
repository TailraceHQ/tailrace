/**
 * Offline verify: wrapTools block + tokenize (no OpenAI network call).
 * Run: npm run verify
 */

import { createTailrace } from "@tailrace/core";
import { wrapTool } from "@tailrace/openai-agents";
import { tool } from "@openai/agents";
import { z } from "zod";

const EMAIL = "customer@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForTailraceTests000FAKE";

async function main(): Promise<void> {
  const tailrace = createTailrace({
    vault: { key: "demo-vault-key-not-for-prod" },
  });

  const echo = tool({
    name: "echo",
    description: "Echo an email",
    parameters: z.object({ email: z.string() }),
    execute: async ({ email }) => {
      if (!email.includes("<EMAIL_")) {
        throw new Error("expected tokenized email in execute");
      }
      return { email };
    },
  });

  const wrappedEcho = wrapTool(tailrace, echo, {
    agent: "verify",
    workflowId: "verify",
  });

  const tokenized = await wrappedEcho.invoke({} as never, JSON.stringify({ email: EMAIL }));
  if (!JSON.stringify(tokenized).includes("<EMAIL_")) {
    throw new Error("expected email token in tool result");
  }
  console.log("ok: tokenize email");

  const post = tool({
    name: "post",
    description: "Post body",
    parameters: z.object({ body: z.string() }),
    execute: async () => "ok",
  });
  const wrappedPost = wrapTool(tailrace, post, {
    agent: "verify",
    workflowId: "verify",
  });

  let blocked = false;
  try {
    await wrappedPost.invoke({} as never, JSON.stringify({ body: FAKE_KEY }));
  } catch (err) {
    if (!(err instanceof Error) || !/api_key/.test(err.message)) {
      throw err;
    }
    blocked = true;
  }
  if (!blocked) {
    throw new Error("api_key was not blocked - policy check failed");
  }
  console.log("ok: block api_key");
  console.log("verify passed");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
