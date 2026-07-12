/**
 * Built-in audit sinks (console + JSONL writer).
 */

import type { AuditEvent, AuditSink, AuditWriter } from "../types";
import { getConsole } from "../console";

/**
 * Log each audit event as a single JSON line on the console.
 *
 * @example
 * ```ts
 * const gate = createTailrace({ audit: { sinks: [consoleSink()] } });
 * ```
 */
export function consoleSink(): AuditSink {
  return {
    emit(event: AuditEvent): void {
      getConsole()?.log(JSON.stringify(event));
    },
  };
}

/**
 * Write each audit event as a JSON line via a caller-supplied {@link AuditWriter}.
 * Core never touches the filesystem - pass a file/stream adapter from Node or the CLI.
 *
 * @example
 * ```ts
 * const lines: string[] = [];
 * const sink = jsonlSink({ write: (line) => { lines.push(line); } });
 * ```
 */
export function jsonlSink(writer: AuditWriter): AuditSink {
  return {
    async emit(event: AuditEvent): Promise<void> {
      await writer.write(JSON.stringify(event) + "\n");
    },
  };
}
