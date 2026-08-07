/**
 * remotePolicy - PolicySource that polls a hosted plane (docs/policy-plane-mvp-scope.md).
 *
 * Fail-open: never throws from load(). Uses last-known-good when the plane is unreachable;
 * on cold start with no cache, returns defaultPolicy() and warns.
 * Poll only in v1 - subscribe is optional and drives interval refresh (no SSE yet).
 */

import {
  defaultPolicy,
  definePolicy,
  type PolicyDocument,
  type PolicySource,
} from "@tailrace/core";

import {
  authHeaders,
  type PolicyEnvelope,
  type RemoteCloudOptions,
  resolveFetch,
  warn,
} from "./internal";

/** Options for {@link remotePolicy}. */
export interface RemotePolicyOptions extends RemoteCloudOptions {
  /** Poll interval for {@link PolicySource.subscribe}. Default 60_000. */
  pollIntervalMs?: number;
  /**
   * Cold-start fallback when the plane is unreachable and nothing is cached.
   * Default: {@link defaultPolicy}.
   */
  fallback?: PolicyDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(body: unknown): PolicyDocument {
  if (!isRecord(body)) {
    throw new Error("policy response must be a JSON object");
  }
  const document = "document" in body ? body.document : body;
  // definePolicy validates; rejects review / invalid detokenize / unknown actions
  return definePolicy(document as PolicyDocument);
}

/**
 * Load policy from a hosted plane endpoint. Pass the full policy URL
 * (e.g. `https://plane.example.com/api/v1/policy`).
 *
 * @example
 * ```ts
 * import { createTailrace } from "@tailrace/core";
 * import { remotePolicy } from "@tailrace/cloud";
 *
 * const tailrace = createTailrace({
 *   policy: remotePolicy("https://plane.example.com/api/v1/policy", {
 *     apiKey: process.env.TAILRACE_API_KEY!,
 *   }),
 * });
 * ```
 */
export function remotePolicy(url: string, options: RemotePolicyOptions): PolicySource {
  const fetchImpl = resolveFetch(options);
  const pollIntervalMs = options.pollIntervalMs ?? 60_000;
  const fallback = options.fallback ?? defaultPolicy();

  let cached: PolicyDocument | null = null;
  let etag: string | null = null;
  const listeners = new Set<(p: PolicyDocument) => void>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const notify = (doc: PolicyDocument): void => {
    for (const cb of listeners) {
      try {
        cb(doc);
      } catch {
        // Listener errors must not break the poll loop.
      }
    }
  };

  const pull = async (): Promise<PolicyDocument> => {
    const headers: Record<string, string> = {
      ...authHeaders(options.apiKey),
    };
    if (etag !== null) {
      headers["If-None-Match"] = etag;
    }

    const res = await fetchImpl(url, { method: "GET", headers });

    if (res.status === 304 && cached !== null) {
      return cached;
    }

    if (!res.ok) {
      throw new Error(`policy fetch failed: HTTP ${String(res.status)}`);
    }

    const nextEtag = res.headers.get("ETag");
    const body = (await res.json()) as PolicyEnvelope | PolicyDocument;
    const doc = parseEnvelope(body);
    const changed = cached === null || JSON.stringify(cached) !== JSON.stringify(doc);
    cached = doc;
    if (nextEtag !== null) etag = nextEtag;
    if (changed) notify(doc);
    return doc;
  };

  const load = async (): Promise<PolicyDocument> => {
    try {
      return await pull();
    } catch (err) {
      if (cached !== null) {
        warn(
          `policy plane unreachable; using last-known-good policy (${err instanceof Error ? err.message : "error"})`,
        );
        return cached;
      }
      warn(
        `policy plane unreachable on cold start; using fallback default policy (${err instanceof Error ? err.message : "error"})`,
      );
      cached = fallback;
      return fallback;
    }
  };

  const ensurePolling = (): void => {
    if (pollTimer !== null || listeners.size === 0) return;
    pollTimer = setInterval(() => {
      void pull().catch((err: unknown) => {
        warn(
          `policy poll failed; keeping last-known-good (${err instanceof Error ? err.message : "error"})`,
        );
      });
    }, pollIntervalMs);
    // Avoid keeping the process alive solely for policy polls (Node).
    if (typeof pollTimer === "object" && pollTimer !== null && "unref" in pollTimer) {
      (pollTimer as { unref?: () => void }).unref?.();
    }
  };

  const stopPollingIfIdle = (): void => {
    if (listeners.size > 0 || pollTimer === null) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  return {
    load,
    subscribe(cb: (p: PolicyDocument) => void): () => void {
      listeners.add(cb);
      ensurePolling();
      return () => {
        listeners.delete(cb);
        stopPollingIfIdle();
      };
    },
  };
}
