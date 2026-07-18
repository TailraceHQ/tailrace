/**
 * Public types for @tailrace/encore.
 */

import type { Decision } from "@tailrace/core";

export interface TailraceEncoreOptions {
  /** Only `"openai-compatible"` is supported in v0.1. Default. */
  mode?: "openai-compatible";
  /** Static agent id, or derive from Encore middleware request. Defaults to `"default"`. */
  agent?: string | ((req: EncoreMiddlewareRequest) => string);
  /** Static or per-request workflow id. Defaults to `"default"`. */
  workflowId?: string | ((req: EncoreMiddlewareRequest) => string);
  onDecision?: (decisions: Decision[]) => void;
}

/**
 * Minimal Encore middleware request surface we bind against.
 * Bound against `encore.dev` middleware handler args at implement time.
 */
export interface EncoreMiddlewareRequest {
  rawRequest?: EncoreRawRequest;
  rawResponse?: EncoreRawResponse;
  requestMeta?: { path?: string; method?: string };
  /** Typed API payload when not raw. */
  payload?: unknown;
  data?: Record<string, unknown>;
}

export interface EncoreRawRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: "data", cb: (chunk: Uint8Array | string) => void): void;
  on(event: "end", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
}

export interface EncoreRawResponse {
  statusCode: number;
  setHeader(name: string, value: string | number | readonly string[]): void;
  getHeader(name: string): string | number | string[] | undefined;
  removeHeader(name: string): void;
  write(chunk: unknown, encoding?: string, cb?: () => void): boolean;
  end(chunk?: unknown, encoding?: string, cb?: () => void): void;
  writeHead?(statusCode: number, headers?: Record<string, string>): void;
}

export interface EncoreHandlerResponse {
  payload?: unknown;
  header: {
    set(key: string, value: string): void;
    add?(key: string, value: string): void;
  };
}
