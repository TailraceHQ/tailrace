/**
 * Minimal encore.dev/api surface for typechecking under Tailrace strict settings.
 * Runtime still resolves the real `encore.dev` peer. Bound against encore.dev@1.53+.
 */
declare module "encore.dev/api" {
  export class HandlerResponse {
    payload: unknown;
    constructor(payload: unknown);
    readonly header: {
      set(key: string, value: string): void;
      add?(key: string, value: string): void;
    };
    /** Override the http status code for successful typed-handler responses. */
    set status(s: number);
  }

  export interface MiddlewareRequest {
    rawRequest?: {
      on(event: "data", cb: (chunk: Uint8Array | string) => void): void;
      on(event: "end", cb: () => void): void;
      on(event: "error", cb: (err: Error) => void): void;
    };
    rawResponse?: {
      statusCode: number;
      setHeader(name: string, value: string | number | readonly string[]): void;
      getHeader(name: string): string | number | string[] | undefined;
      removeHeader(name: string): void;
      write(chunk: unknown, encoding?: string, cb?: () => void): boolean;
      end(chunk?: unknown, encoding?: string, cb?: () => void): void;
    };
    data?: Record<string, unknown>;
    requestMeta?: { path?: string; method?: string };
  }

  export type Next = (req: MiddlewareRequest) => Promise<HandlerResponse>;
  export type MiddlewareFn = (req: MiddlewareRequest, next: Next) => Promise<HandlerResponse>;

  export interface MiddlewareOptions {
    target?: {
      isRaw?: boolean;
      all?: boolean;
      auth?: boolean;
      expose?: boolean;
      tags?: string[];
    };
  }

  export interface Middleware extends MiddlewareFn {
    options?: MiddlewareOptions;
  }

  export function middleware(m: MiddlewareFn): Middleware;
  export function middleware(options: MiddlewareOptions, fn: MiddlewareFn): Middleware;
}
