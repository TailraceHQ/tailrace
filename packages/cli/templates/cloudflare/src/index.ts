/**
 * Cloudflare Worker agent: createCloudflareTailrace + withCloudflareAgents().forChat.
 *
 * POST /api/chat { prompt } - block secrets, tokenize PII, restore at egress.
 * Uses KV binding TAILRACE_VAULT when present; mock echo model without OPENAI_API_KEY.
 */

import { PolicyViolationError } from "@tailrace/core";
import { createCloudflareTailrace, withCloudflareAgents } from "@tailrace/cloudflare-agents";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { createEchoModel } from "./mock-model";

const AGENT = "cf-agent";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        'Tailrace Cloudflare agent. POST /api/chat with JSON { "prompt": "..." }.\n',
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      return new Response("Not found", { status: 404 });
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt ?? "";
    const workflowId = request.headers.get("x-workflow-id") ?? crypto.randomUUID();

    const vaultKey = env.TAILRACE_VAULT_KEY ?? "demo-vault-key-not-for-prod";
    const tr = createCloudflareTailrace(env, {
      agent: AGENT,
      workflowId,
      kv: env.TAILRACE_VAULT,
      vaultKey,
      onDecision: (decisions) => {
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
    });

    const baseModel = env.OPENAI_API_KEY
      ? createOpenAI({ apiKey: env.OPENAI_API_KEY })("gpt-4o-mini")
      : createEchoModel();

    const { model, tools } = withCloudflareAgents(tr, {
      agent: AGENT,
      workflowId,
    }).forChat({
      model: baseModel,
      tools: {
        lookupCustomer: tool({
          description: "Look up a customer by id; returns a synthetic contact email.",
          inputSchema: z.object({ customerId: z.string() }),
          execute: async ({ customerId }) => ({
            customerId,
            email: "customer@example.com",
          }),
        }),
      },
    });

    try {
      const result = await generateText({
        model,
        prompt,
        tools,
        stopWhen: stepCountIs(2),
      });

      const restored = await tr.restore(result.text, {
        boundary: { kind: "egress", sink: "ui" },
        identity: { agent: AGENT },
        workflowId,
      });

      return Response.json({
        text: restored.output,
        workflowId,
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
  },
} satisfies ExportedHandler<Env>;
