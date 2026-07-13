/**
 * tailraceHono — OpenAI-compatible Hono middleware (docs/integrations.md §3).
 */

import type { Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import type { Context, MiddlewareHandler, Next } from "hono";

import { checkWithOpts } from "./internal/context";
import { POLICY_VIOLATION_STATUS, policyViolationBody } from "./internal/errors";
import {
  applyCompletionText,
  extractCompletionText,
  extractMessageTextTree,
  parseOpenAiBody,
  type OpenAiChatBody,
} from "./internal/openai-body";
import { createSseTransform } from "./internal/sse";
import type { TailraceHonoOptions } from "./types";

function modelBoundary(body: OpenAiChatBody) {
  const provider = typeof body.model === "string" && body.model.length > 0 ? body.model : "unknown";
  return { kind: "model" as const, provider };
}

function isEventStream(contentType: string | undefined): boolean {
  if (contentType === undefined) return false;
  return contentType.toLowerCase().includes("text/event-stream");
}

/**
 * Build Tailrace middleware for a Hono app.
 *
 * @example
 * ```ts
 * app.use("/v1/*", tailraceHono(tailrace, { mode: "openai-compatible" }));
 * ```
 */
export function tailraceHono(tailrace: Tailrace, opts?: TailraceHonoOptions): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    let rawText: string;
    try {
      rawText = await c.req.text();
    } catch {
      await next();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      // Non-JSON: pass through.
      await next();
      return;
    }

    const body = parseOpenAiBody(parsed);
    if (body === null) {
      await next();
      return;
    }

    const boundary = modelBoundary(body);
    const { tree, apply } = extractMessageTextTree(body);

    try {
      const { output } = await checkWithOpts(tailrace, c, tree, boundary, opts);
      apply(output);
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        return c.json(policyViolationBody(err), POLICY_VIOLATION_STATUS);
      }
      throw err;
    }

    // Forward rewritten body to downstream handlers. HonoRequest caches the first body
    // read, so override json/text/raw for subsequent handlers in this request.
    const rewrittenText = JSON.stringify(body);
    const headers = new Headers(c.req.raw.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    const newRaw = new Request(c.req.url, {
      method: c.req.method,
      headers,
      body: rewrittenText,
    });
    Object.defineProperty(c.req, "raw", { configurable: true, value: newRaw });
    Object.defineProperty(c.req, "json", {
      configurable: true,
      value: async () => body,
    });
    Object.defineProperty(c.req, "text", {
      configurable: true,
      value: async () => rewrittenText,
    });

    await next();

    const res = c.res;
    if (res === undefined) return;

    const contentType = res.headers.get("content-type") ?? undefined;

    if (isEventStream(contentType) && res.body !== null) {
      const scanned = createSseTransform(tailrace, c, boundary, opts, res.body);
      c.res = new Response(scanned, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
      return;
    }

    // Non-SSE JSON completion
    try {
      const json: unknown = await res.clone().json();
      const text = extractCompletionText(json);
      if (text.length === 0) return;
      try {
        const { output } = await checkWithOpts(tailrace, c, text, boundary, opts);
        const nextBody = applyCompletionText(json, output);
        c.res = new Response(JSON.stringify(nextBody), {
          status: res.status,
          statusText: res.statusText,
          headers: (() => {
            const h = new Headers(res.headers);
            h.set("content-type", "application/json");
            h.delete("content-length");
            return h;
          })(),
        });
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          c.res = c.json(policyViolationBody(err), POLICY_VIOLATION_STATUS);
          return;
        }
        throw err;
      }
    } catch {
      // Not JSON - leave response as-is.
    }
  };
}
