/**
 * Fire-and-forget audit emitter. Never throws into the request path (prime directive 4:
 * fail open for availability). Each sink.emit is isolated - a throwing or rejecting sink
 * cannot crash check/restore.
 */

import { getConsole } from "../console";
import type { AuditEvent, AuditSink, Decision } from "../types";

export interface AuditEmitter {
  emit(type: "check" | "restore", workflowId: string, decisions: Decision[]): void;
}

function warnSinkFailure(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  getConsole()?.warn(`[tailrace] audit sink failed (swallowed): ${message}`);
}

/**
 * Create an audit emitter that fans out to sinks and an optional onDecision hook.
 */
export function createAuditEmitter(
  sinks: AuditSink[] = [],
  onDecision?: (decisions: Decision[]) => void,
): AuditEmitter {
  return {
    emit(type, workflowId, decisions): void {
      if (onDecision !== undefined) {
        try {
          onDecision(decisions);
        } catch (err) {
          warnSinkFailure(err);
        }
      }
      if (sinks.length === 0) return;
      const event: AuditEvent = {
        type,
        workflowId,
        timestamp: Date.now(),
        decisions,
      };
      for (const sink of sinks) {
        try {
          const result = sink.emit(event);
          if (result !== undefined && typeof (result as Promise<void>).then === "function") {
            void (result as Promise<void>).catch((err: unknown) => {
              warnSinkFailure(err);
            });
          }
        } catch (err) {
          warnSinkFailure(err);
        }
      }
    },
  };
}
