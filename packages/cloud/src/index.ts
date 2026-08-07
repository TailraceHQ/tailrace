/**
 * @tailrace/cloud - hosted policy plane client (PolicySource + AuditSink).
 *
 * Thin, no policy logic. Polls policy and ships audit events out-of-band so
 * check/restore never block on the network (docs/policy-plane-mvp-scope.md).
 */

export { remotePolicy } from "./remote-policy";
export type { RemotePolicyOptions } from "./remote-policy";
export { remoteAuditSink } from "./remote-audit-sink";
export type { RemoteAuditSinkOptions } from "./remote-audit-sink";
export type { RemoteCloudOptions, PolicyEnvelope, AuditBatchBody } from "./internal";
