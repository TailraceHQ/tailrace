/**
 * Demo 1 API route — block secrets before the provider; tokenize + restore at egress.
 *
 * Dual-mode: mock echo when OPENAI_API_KEY is absent; openai() when present.
 * workflowId: from `x-workflow-id` header, or a per-request UUID.
 */

import { createTailrace, PolicyViolationError } from "@tailrace/core";
import { withAiSdk, type AiSdkWrapOptions } from "@tailrace/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { createEchoModel } from "@/lib/mock-model";

export const runtime = "nodejs";

// Demo fallback for local mock only - set TAILRACE_VAULT_KEY for live/deploy.
const vaultKey = process.env["TAILRACE_VAULT_KEY"] ?? "demo-vault-key-not-for-prod";

const tailrace = withAiSdk(
  createTailrace({
    vault: { key: vaultKey },
  }),
);

function selectModel() {
  if (process.env["OPENAI_API_KEY"]) {
    return openai("gpt-4o-mini");
  }
  return createEchoModel();
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as { prompt?: string };
  const prompt = body.prompt ?? "";
  const workflowId =
    req.headers.get("x-workflow-id") ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wf-${Date.now()}`);

  const wrapOpts: AiSdkWrapOptions = {
    workflowId,
    agent: "demo-1",
    onDecision: (decisions) => {
      // Never log raw values - decisions carry entity + contentHash only.
      console.info(
        "[tailrace]",
        decisions.map((d) => ({
          action: d.action,
          entity: d.entity,
          rule: d.rule,
          appliedAs: d.appliedAs,
        })),
      );
    },
  };

  const model = tailrace.model(selectModel(), wrapOpts);

  const tools = tailrace.tools(
    {
      lookupCustomer: tool({
        description: "Look up a customer by id; returns a synthetic contact email.",
        inputSchema: z.object({ customerId: z.string() }),
        execute: async ({ customerId }) => ({
          customerId,
          email: "customer@example.com",
        }),
      }),
    },
    wrapOpts,
  );

  try {
    const result = await generateText({
      model,
      prompt,
      tools,
      // Allow one tool round-trip on the live path; Demo 1 A/B stay prompt-only.
      stopWhen: stepCountIs(2),
    });

    // Egress restore so the UI shows the real email (docs/milestones.md Demo 1 Run B).
    const restored = await tailrace.restore(result.text, {
      boundary: { kind: "egress", sink: "ui" },
      identity: { agent: "demo-1" },
      workflowId,
    });

    return Response.json({
      text: restored.output,
      workflowId,
      // Transformed (tokenized) text as seen by the model before restore.
      modelSaw: result.text,
    });
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      const d = err.decisions[0];
      return Response.json(
        {
          error: {
            type: "policy_violation",
            entity: d?.entity ?? "unknown",
            rule: d?.rule ?? "unknown",
            message: err.message,
          },
        },
        { status: 422 },
      );
    }
    throw err;
  }
}
