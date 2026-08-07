/**
 * remoteAuditSink - AuditSink that batches events to a hosted plane.
 *
 * Delivery is fire-and-forget: failures are dropped (never thrown) so audit
 * shipping can never break the host. Batches ship on interval or when the
 * buffer hits a size cap.
 */

import type { AuditEvent, AuditSink } from "@tailrace/core";

import { authHeaders, type RemoteCloudOptions, resolveFetch, warn } from "./internal";

/** Options for {@link remoteAuditSink}. */
export interface RemoteAuditSinkOptions extends RemoteCloudOptions {
  /** Flush interval. Default 2_000. */
  batchIntervalMs?: number;
  /** Max events per batch / flush trigger. Default 50. */
  maxBatchSize?: number;
}

/**
 * Ship audit events to a hosted plane. Pass the full audit ingest URL
 * (e.g. `https://plane.example.com/api/v1/audit`).
 *
 * @example
 * ```ts
 * import { createTailrace } from "@tailrace/core";
 * import { remoteAuditSink } from "@tailrace/cloud";
 *
 * const tailrace = createTailrace({
 *   audit: {
 *     sinks: [
 *       remoteAuditSink("https://plane.example.com/api/v1/audit", {
 *         apiKey: process.env.TAILRACE_API_KEY!,
 *       }),
 *     ],
 *   },
 * });
 * ```
 */
export function remoteAuditSink(url: string, options: RemoteAuditSinkOptions): AuditSink {
  const fetchImpl = resolveFetch(options);
  const batchIntervalMs = options.batchIntervalMs ?? 2_000;
  const maxBatchSize = options.maxBatchSize ?? 50;

  const buffer: AuditEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  const clearTimer = (): void => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const schedule = (): void => {
    if (timer !== null || buffer.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, batchIntervalMs);
    if (typeof timer === "object" && timer !== null && "unref" in timer) {
      (timer as { unref?: () => void }).unref?.();
    }
  };

  const flush = async (): Promise<void> => {
    if (flushing || buffer.length === 0) return;
    flushing = true;
    clearTimer();

    const batch = buffer.splice(0, maxBatchSize);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          ...authHeaders(options.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: batch }),
      });
      if (!res.ok) {
        warn(
          `audit delivery failed: HTTP ${String(res.status)}; dropped ${String(batch.length)} event(s)`,
        );
      }
    } catch (err) {
      warn(
        `audit delivery failed; dropped ${String(batch.length)} event(s) (${err instanceof Error ? err.message : "error"})`,
      );
    } finally {
      flushing = false;
      if (buffer.length > 0) schedule();
    }
  };

  return {
    emit(event: AuditEvent): void {
      buffer.push(event);
      if (buffer.length >= maxBatchSize) {
        void flush();
        return;
      }
      schedule();
    },
  };
}
