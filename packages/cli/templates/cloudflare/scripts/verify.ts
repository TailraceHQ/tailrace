/**
 * Offline verify: tokenize + block via createCloudflareTailrace (memory path).
 * Run: npm run verify
 */

import { createCloudflareTailrace } from "@tailrace/cloudflare-agents";

const EMAIL = "customer@example.com";
const FAKE_KEY = "sk_test_51FakeKeyForTailraceTests000FAKE";

async function main(): Promise<void> {
  const warn = console.warn;
  console.warn = () => {};
  const tr = createCloudflareTailrace({}, { agent: "verify", workflowId: "verify" });
  console.warn = warn;

  const tokenized = await tr.check(`Email ${EMAIL}`, {
    boundary: { kind: "tool", name: "crm", direction: "out" },
    identity: { agent: "verify" },
    workflowId: "verify",
  });
  if (!String(tokenized.output).includes("<EMAIL_")) {
    throw new Error("expected email token in check output");
  }
  console.log("ok: tokenize email");

  let blocked = false;
  try {
    await tr.check(`key=${FAKE_KEY}`, {
      boundary: { kind: "model", direction: "out" },
      identity: { agent: "verify" },
      workflowId: "verify",
    });
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
