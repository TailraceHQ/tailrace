/**
 * Shared options and HTTP helpers for the hosted policy plane client.
 */

/** Options shared by remote policy and audit clients. */
export interface RemoteCloudOptions {
  /** Project/environment API key (`Authorization: Bearer …`). */
  apiKey: string;
  /**
   * Optional fetch implementation. Defaults to `globalThis.fetch`.
   * Inject in tests; do not use to add network hops on the request hot path -
   * these clients are out-of-band only (init / poll / async audit).
   */
  fetch?: typeof globalThis.fetch;
}

/** Envelope returned by `GET` / `POST` policy endpoints. */
export interface PolicyEnvelope {
  version: number;
  document: unknown;
  publishedAt?: string;
}

/** Batch body accepted by `POST` audit ingest. */
export interface AuditBatchBody {
  events: unknown[];
}

interface MinimalConsole {
  warn: (...args: unknown[]) => void;
}

export function warn(message: string): void {
  const c = (globalThis as { console?: MinimalConsole }).console;
  c?.warn(`[tailrace/cloud] ${message}`);
}

export function resolveFetch(opts: RemoteCloudOptions): typeof globalThis.fetch {
  if (opts.fetch !== undefined) return opts.fetch.bind(globalThis);
  const f = globalThis.fetch;
  if (typeof f !== "function") {
    throw new Error("@tailrace/cloud requires fetch (Node 20+, Workers, or browsers)");
  }
  return f.bind(globalThis);
}

export function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}
