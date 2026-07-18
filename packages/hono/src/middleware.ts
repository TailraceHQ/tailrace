/**
 * tailraceHono — OpenAI-compatible Hono middleware (docs/integrations.md §3).
 * Thin wrapper over @tailrace/http.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import {
  createOpenAiCompatSseTransform,
  isEventStream,
  parseOpenAiBody,
  POLICY_VIOLATION_STATUS,
  policyViolationBody,
  runOpenAiCompatJsonResponseCheck,
  runOpenAiCompatRequestCheck,
  type OpenAiCompatIdentityOpts,
} from "@tailrace/http";
import type { Context, MiddlewareHandler, Next } from "hono";

import type { TailraceHonoOptions } from "./types";

function resolveIdentity(c: Context, opts?: TailraceHonoOptions): OpenAiCompatIdentityOpts {
  const identity: OpenAiCompatIdentityOpts = {
    agent: opts?.agent?.(c) ?? "default",
  };
  if (opts?.workflowId !== undefined) {
    identity.workflowId =
      typeof opts.workflowId === "function" ? opts.workflowId(c) : opts.workflowId;
  }
  if (opts?.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  return identity;
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

    const requestIdentity = resolveIdentity(c, opts);
    let boundary: Boundary;
    try {
      const result = await runOpenAiCompatRequestCheck(tailrace, body, requestIdentity);
      boundary = result.boundary;
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

    // Re-resolve after next() so agent/workflowId callbacks that read context
    // state set by downstream handlers (e.g. auth middleware) see it, matching
    // the request-time resolution used for runOpenAiCompatRequestCheck.
    const responseIdentity = resolveIdentity(c, opts);

    const contentType = res.headers.get("content-type") ?? undefined;

    if (isEventStream(contentType) && res.body !== null) {
      const scanned = createOpenAiCompatSseTransform(
        tailrace,
        boundary,
        responseIdentity,
        res.body,
      );
      c.res = new Response(scanned, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
      return;
    }

    // Non-SSE JSON completion
    let json: unknown;
    try {
      json = await res.clone().json();
    } catch {
      // Not JSON - nothing this pipeline understands to scan, leave as-is.
      return;
    }

    try {
      const nextBody = await runOpenAiCompatJsonResponseCheck(
        tailrace,
        json,
        boundary,
        responseIdentity,
      );
      if (nextBody === json) return;
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
      // Fail closed: an unexpected check failure must never ship the
      // unscanned response body (docs/architecture.md - fail closed for block).
      c.res = c.json({ error: { type: "internal_error" } }, 500);
    }
  };
}
