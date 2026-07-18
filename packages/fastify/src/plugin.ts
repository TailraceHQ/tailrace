/**
 * tailraceFastify — OpenAI-compatible Fastify plugin (docs/integrations.md §11).
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
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { TailraceFastifyOptions } from "./types";

const BOUNDARY_KEY = "tailraceBoundary";
const IDENTITY_KEY = "tailraceIdentity";

function resolveIdentity(
  req: FastifyRequest,
  opts?: TailraceFastifyOptions,
): OpenAiCompatIdentityOpts {
  const identity: OpenAiCompatIdentityOpts = {
    agent: opts?.agent?.(req) ?? "default",
  };
  if (opts?.workflowId !== undefined) {
    identity.workflowId =
      typeof opts.workflowId === "function" ? opts.workflowId(req) : opts.workflowId;
  }
  if (opts?.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  return identity;
}

function contentTypeOf(reply: FastifyReply): string | undefined {
  const v = reply.getHeader("content-type");
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

/**
 * Build a Fastify plugin that enforces Tailrace on OpenAI-compat routes.
 *
 * @example
 * ```ts
 * await app.register(tailraceFastify(tailrace));
 * ```
 */
export function tailraceFastify(
  tailrace: Tailrace,
  opts?: TailraceFastifyOptions,
): FastifyPluginAsync {
  // Break encapsulation so hooks apply to routes registered on the parent app.
  return fp(async (app) => {
    app.addHook("preHandler", async (req, reply) => {
      const body = parseOpenAiBody(req.body);
      if (body === null) return;

      const identity = resolveIdentity(req, opts);
      try {
        const result = await runOpenAiCompatRequestCheck(tailrace, body, identity);
        req.body = body;
        (req as FastifyRequest & Record<string, unknown>)[BOUNDARY_KEY] = result.boundary;
        (req as FastifyRequest & Record<string, unknown>)[IDENTITY_KEY] = identity;
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          return reply.status(POLICY_VIOLATION_STATUS).send(policyViolationBody(err));
        }
        throw err;
      }
    });

    app.addHook("onSend", async (req, reply, payload) => {
      const boundary = (req as FastifyRequest & Record<string, unknown>)[BOUNDARY_KEY] as
        Boundary | undefined;
      if (boundary === undefined) return payload;

      const identity = (req as FastifyRequest & Record<string, unknown>)[
        IDENTITY_KEY
      ] as OpenAiCompatIdentityOpts;

      const ct = contentTypeOf(reply);
      if (isEventStream(ct)) {
        return await transformSsePayload(tailrace, boundary, identity, payload, reply);
      }

      // Any other stream payload (file download, proxy passthrough, etc.) isn't
      // something this pipeline understands - pass it through unscanned rather
      // than guessing it's an OpenAI SSE stream from its shape alone.
      if (
        payload instanceof Readable ||
        (typeof payload === "object" &&
          payload !== null &&
          typeof (payload as { pipe?: unknown }).pipe === "function")
      ) {
        return payload;
      }

      if (payload === undefined || payload === null) return payload;

      let json: unknown;
      try {
        if (typeof payload === "string") {
          json = JSON.parse(payload);
        } else if (Buffer.isBuffer(payload)) {
          json = JSON.parse(payload.toString("utf8"));
        } else if (typeof payload === "object") {
          json = payload;
        } else {
          return payload;
        }
      } catch {
        return payload;
      }

      try {
        const nextBody = await runOpenAiCompatJsonResponseCheck(tailrace, json, boundary, identity);
        // Fastify 5 onSend requires string | Buffer for JSON payloads.
        return JSON.stringify(nextBody);
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          reply.code(POLICY_VIOLATION_STATUS);
          return JSON.stringify(policyViolationBody(err));
        }
        throw err;
      }
    });
  }) as FastifyPluginAsync;
}

async function transformSsePayload(
  tailrace: Tailrace,
  boundary: Boundary,
  identity: OpenAiCompatIdentityOpts,
  payload: unknown,
  _reply: FastifyReply,
): Promise<Readable> {
  let webIn: ReadableStream<Uint8Array>;

  if (payload instanceof Readable) {
    webIn = Readable.toWeb(payload) as ReadableStream<Uint8Array>;
  } else if (typeof payload === "string" || Buffer.isBuffer(payload)) {
    const buf = typeof payload === "string" ? Buffer.from(payload, "utf8") : payload;
    webIn = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(buf));
        controller.close();
      },
    });
  } else {
    webIn = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  const scanned = createOpenAiCompatSseTransform(tailrace, boundary, identity, webIn);
  return Readable.fromWeb(scanned as NodeReadableStream<Uint8Array>);
}
