/**
 * JSONL audit writer for `.tailrace/audit.jsonl`.
 *
 * Uses sync append so Claude Code hook processes flush before exit (audit emitter
 * does not await sink promises on the request path).
 */

import { mkdirSync, appendFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditWriter } from "@tailrace/core";

/**
 * Append-only writer for {@link jsonlSink}. Creates parent dirs on first write.
 */
export function createFsAuditWriter(auditPath: string): AuditWriter {
  let ensured = false;
  return {
    write(line: string): void {
      if (!ensured) {
        const dir = dirname(auditPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        ensured = true;
      }
      appendFileSync(auditPath, line.endsWith("\n") ? line : `${line}\n`, "utf8");
    },
  };
}
