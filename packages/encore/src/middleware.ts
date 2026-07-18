/**
 * tailraceEncore — Encore.ts middleware (docs/integrations.md §13).
 *
 * Bound against `encore.dev/api` `middleware` helper (encore.dev@1.53.x).
 * Prefer raw openai-compat endpoints (`api.raw`) so request/response bodies
 * and SSE are available.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import {
  parseOpenAiBody,
  POLICY_VIOLATION_STATUS,
  policyViolationBody,
  runOpenAiCompatJsonResponseCheck,
  runOpenAiCompatRequestCheck,
  wrapNodeResponse,
  type OpenAiCompatIdentityOpts,
  type OpenAiChatBody,
} from "@tailrace/http";
import { HandlerResponse, middleware, type MiddlewareRequest, type Next } from "encore.dev/api";
import { Readable } from "node:stream";

import type { TailraceEncoreOptions } from "./types";

function resolveIdentity(
  req: MiddlewareRequest,
  opts?: TailraceEncoreOptions,
): OpenAiCompatIdentityOpts {
  const identity: OpenAiCompatIdentityOpts = {
    agent:
      typeof opts?.agent === "function" ? opts.agent(req as never) : (opts?.agent ?? "default"),
  };
  if (opts?.workflowId !== undefined) {
    identity.workflowId =
      typeof opts.workflowId === "function" ? opts.workflowId(req as never) : opts.workflowId;
  }
  if (opts?.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  return identity;
}

function readRawBody(req: {
  on(event: "data", cb: (chunk: Uint8Array | string) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    req.on("error", reject);
  });
}

/**
 * Build Encore middleware that enforces Tailrace on openai-compat traffic.
 *
 * @example
 * ```ts
 * export default new Service("api", {
 *   middlewares: [tailraceEncore(tailrace, { agent: "api" })],
 * });
 * ```
 */
export function tailraceEncore(tailrace: Tailrace, opts?: TailraceEncoreOptions) {
  return middleware({ target: { isRaw: true } }, async (req, next) => {
    const identity = resolveIdentity(req, opts);

    if (req.rawRequest !== undefined && req.rawResponse !== undefined) {
      return await handleRaw(tailrace, req, identity, next);
    }

    return await handleTyped(tailrace, req, identity, next);
  });
}

async function handleTyped(
  tailrace: Tailrace,
  req: MiddlewareRequest,
  identity: OpenAiCompatIdentityOpts,
  next: Next,
): Promise<HandlerResponse> {
  // Typed APIs: when request meta carries a chat-shaped payload via data, check it.
  const maybeBody = (req as MiddlewareRequest & { data?: { payload?: unknown } }).data?.payload;
  const body = parseOpenAiBody(maybeBody);
  let boundary: Boundary | undefined;
  if (body !== null) {
    try {
      const result = await runOpenAiCompatRequestCheck(tailrace, body, identity);
      boundary = result.boundary;
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        const resp = new HandlerResponse(policyViolationBody(err));
        resp.status = POLICY_VIOLATION_STATUS;
        return resp;
      }
      throw err;
    }
  }

  const resp = await next(req);
  if (boundary === undefined) return resp;

  try {
    resp.payload = await runOpenAiCompatJsonResponseCheck(
      tailrace,
      resp.payload,
      boundary,
      identity,
    );
    return resp;
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      resp.payload = policyViolationBody(err);
      resp.status = POLICY_VIOLATION_STATUS;
      return resp;
    }
    throw err;
  }
}

async function handleRaw(
  tailrace: Tailrace,
  req: MiddlewareRequest,
  identity: OpenAiCompatIdentityOpts,
  next: Next,
): Promise<HandlerResponse> {
  const rawReq = req.rawRequest;
  const rawRes = req.rawResponse;
  if (rawReq === undefined || rawRes === undefined) {
    return await next(req);
  }

  const rawBuf = await readRawBody(rawReq);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBuf.toString("utf8")) as unknown;
  } catch {
    reinjectRawBody(req, rawBuf);
    return await next(req);
  }

  const body = parseOpenAiBody(parsed);
  if (body === null) {
    reinjectRawBody(req, rawBuf);
    return await next(req);
  }

  let boundary: Boundary;
  try {
    const result = await runOpenAiCompatRequestCheck(tailrace, body, identity);
    boundary = result.boundary;
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      rawRes.statusCode = POLICY_VIOLATION_STATUS;
      rawRes.setHeader("content-type", "application/json");
      rawRes.end(JSON.stringify(policyViolationBody(err)));
      return new HandlerResponse(null);
    }
    throw err;
  }

  reinjectRawBody(req, Buffer.from(JSON.stringify(body), "utf8"));
  wrapNodeResponse(rawRes, tailrace, boundary, identity, (err: unknown) => {
    // Raw Encore responses have no downstream error-handling middleware to
    // delegate to; log rather than let the error crash the process as an
    // unhandled stream 'error' event.
    console.error("[tailrace/encore] response check failed:", err);
  });
  return await next(req);
}

function reinjectRawBody(req: MiddlewareRequest, buf: Buffer): void {
  const readable = Readable.from([buf]);
  // Encore middleware mutates rawRequest so the handler sees the rewritten body.
  (req as { rawRequest: unknown }).rawRequest = readable;
}

/** Test helper: run request check against a chat body (no Encore runtime). */
export async function checkEncoreOpenAiBody(
  tailrace: Tailrace,
  body: OpenAiChatBody,
  opts?: TailraceEncoreOptions,
): Promise<OpenAiChatBody> {
  const identity: OpenAiCompatIdentityOpts = {
    agent: typeof opts?.agent === "string" ? opts.agent : "default",
  };
  if (typeof opts?.workflowId === "string") {
    identity.workflowId = opts.workflowId;
  }
  if (opts?.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  const { body: out } = await runOpenAiCompatRequestCheck(tailrace, body, identity);
  return out;
}
