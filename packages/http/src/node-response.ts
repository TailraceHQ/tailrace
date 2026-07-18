/**
 * Shared Node `http.ServerResponse`-shaped response wrapper: buffers a JSON or
 * SSE response, runs it through the OpenAI-compat response check, and rewrites
 * it before the real bytes reach the socket. Used by any Node-based host
 * adapter (Express, NestJS, Encore raw) instead of each reimplementing the
 * write/end monkey-patch independently.
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import { Readable } from "node:stream";
import { ReadableStream as NodeReadableStream } from "node:stream/web";

import { isEventStream } from "./openai-body";
import { POLICY_VIOLATION_STATUS, policyViolationBody } from "./errors";
import { runOpenAiCompatJsonResponseCheck } from "./pipeline";
import { createOpenAiCompatSseTransform } from "./sse";
import type { OpenAiCompatIdentityOpts } from "./types";

/** Minimal subset of `http.ServerResponse` this wrapper needs. */
export interface NodeLikeResponse {
  statusCode: number;
  getHeader(name: string): string | number | readonly string[] | undefined;
  setHeader(name: string, value: string): unknown;
  removeHeader?(name: string): unknown;
  write(chunk: unknown, ...rest: unknown[]): boolean;
  end(chunk?: unknown, ...rest: unknown[]): unknown;
  writeHead?(...args: unknown[]): unknown;
}

function contentTypeOf(res: NodeLikeResponse): string | undefined {
  const v = res.getHeader("content-type");
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  if (typeof v === "number") return String(v);
  return undefined;
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  return Buffer.from(typeof chunk === "string" ? chunk : String(chunk));
}

function findCallback(rest: unknown[]): (() => void) | undefined {
  return rest.find((r): r is () => void => typeof r === "function");
}

/**
 * Monkey-patch `res.write`/`res.end` (and `res.writeHead` if present) so the
 * response body is buffered, checked, and rewritten before it reaches the
 * client. On an unexpected (non-`PolicyViolationError`) failure the response
 * fails closed with a generic 500 - the original unscanned body is never sent.
 *
 * @example
 * ```ts
 * wrapNodeResponse(res, tailrace, boundary, identity, (err) => next(err));
 * ```
 */
export function wrapNodeResponse(
  res: NodeLikeResponse,
  tailrace: Tailrace,
  boundary: Boundary,
  identity: OpenAiCompatIdentityOpts | undefined,
  onError: (err: unknown) => void,
): void {
  const chunks: Buffer[] = [];
  let sseMode = false;
  let sseSource: Readable | null = null;
  let finished = false;

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const originalWriteHead = res.writeHead?.bind(res);

  const enterSseIfNeeded = (): void => {
    if (sseMode) return;
    if (!isEventStream(contentTypeOf(res))) return;
    sseMode = true;
    sseSource = new Readable({
      read() {
        /* pull-driven via push */
      },
    });
    void (async () => {
      try {
        const webIn = Readable.toWeb(sseSource!) as ReadableStream<Uint8Array>;
        const scanned = createOpenAiCompatSseTransform(tailrace, boundary, identity, webIn);
        const nodeOut = Readable.fromWeb(scanned as NodeReadableStream<Uint8Array>);
        nodeOut.on("data", (chunk: Buffer | string) => {
          originalWrite(chunk);
        });
        nodeOut.on("end", () => {
          originalEnd();
        });
        nodeOut.on("error", (err: unknown) => {
          onError(err);
        });
      } catch (err) {
        onError(err);
      }
    })();
  };

  if (originalWriteHead !== undefined) {
    res.writeHead = (...args: unknown[]): unknown => {
      const result = originalWriteHead(...args);
      enterSseIfNeeded();
      return result;
    };
  }

  res.write = ((chunk: unknown, ...rest: unknown[]) => {
    enterSseIfNeeded();
    const cb = findCallback(rest);
    if (sseMode && sseSource !== null) {
      sseSource.push(chunk === undefined || chunk === null ? Buffer.alloc(0) : toBuffer(chunk));
      cb?.();
      return true;
    }
    if (chunk !== undefined && chunk !== null && chunk !== "") {
      chunks.push(toBuffer(chunk));
    }
    cb?.();
    return true;
  }) as NodeLikeResponse["write"];

  res.end = ((chunk?: unknown, ...rest: unknown[]) => {
    if (finished) return res;
    enterSseIfNeeded();
    const cb = findCallback(rest);

    if (sseMode && sseSource !== null) {
      if (chunk !== undefined && chunk !== null && typeof chunk !== "function") {
        sseSource.push(toBuffer(chunk));
      }
      sseSource.push(null);
      finished = true;
      cb?.();
      return res;
    }

    if (chunk !== undefined && chunk !== null && typeof chunk !== "function") {
      chunks.push(toBuffer(chunk));
    }
    finished = true;

    const finish = (out?: Buffer): void => {
      if (out !== undefined && cb !== undefined) originalEnd(out, cb);
      else if (out !== undefined) originalEnd(out);
      else if (cb !== undefined) originalEnd(cb);
      else originalEnd();
    };

    void (async () => {
      try {
        const raw = Buffer.concat(chunks);
        if (raw.length === 0) {
          finish();
          return;
        }

        let json: unknown;
        try {
          json = JSON.parse(raw.toString("utf8"));
        } catch {
          // Not JSON: nothing this pipeline understands to scan - pass through unchanged.
          finish(raw);
          return;
        }

        try {
          const nextBody = await runOpenAiCompatJsonResponseCheck(
            tailrace,
            json,
            boundary,
            identity,
          );
          res.setHeader("content-type", "application/json");
          res.removeHeader?.("content-length");
          finish(Buffer.from(JSON.stringify(nextBody), "utf8"));
        } catch (err) {
          if (err instanceof PolicyViolationError) {
            res.statusCode = POLICY_VIOLATION_STATUS;
            res.setHeader("content-type", "application/json");
            res.removeHeader?.("content-length");
            finish(Buffer.from(JSON.stringify(policyViolationBody(err)), "utf8"));
            return;
          }
          // Fail closed: an unexpected check failure must never ship the
          // unscanned raw body (docs/architecture.md - fail closed for block).
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.removeHeader?.("content-length");
          finish(Buffer.from(JSON.stringify({ error: { type: "internal_error" } }), "utf8"));
          onError(err);
        }
      } catch (err) {
        onError(err);
      }
    })();

    return res;
  }) as NodeLikeResponse["end"];
}
