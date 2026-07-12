/**
 * Audit emitter and sinks. Internal to core - public sinks re-exported from the package entry.
 */

export { createAuditEmitter } from "./emitter";
export type { AuditEmitter } from "./emitter";
export { consoleSink, jsonlSink } from "./sinks";
