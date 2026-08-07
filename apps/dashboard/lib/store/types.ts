/**
 * Policy plane data model (org → project → environment → policy versions + audit).
 * MVP: one API key per environment; no RBAC.
 */

import type { AuditEvent, PolicyDocument } from "@tailrace/core";

export interface Org {
  id: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  createdAt: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  /** SHA-256 hex of the raw API key. Never store the raw key. */
  apiKeyHash: string;
  /** First 8 chars of the raw key for display (e.g. tr_live_ab…). */
  apiKeyPrefix: string;
  createdAt: string;
}

export interface PolicyVersion {
  id: string;
  environmentId: string;
  version: number;
  document: PolicyDocument;
  publishedAt: string;
}

export interface StoredAuditEvent {
  id: string;
  environmentId: string;
  type: AuditEvent["type"];
  workflowId: string;
  timestamp: number;
  decisions: AuditEvent["decisions"];
  ingestedAt: string;
}

export interface AuditQuery {
  entity?: string;
  boundaryKind?: string;
  identity?: string;
  rule?: string;
  contentHash?: string;
  limit?: number;
  offset?: number;
}

export interface PlaneStore {
  ensureBootstrap(): Promise<{
    org: Org;
    project: Project;
    environment: Environment;
    /** Raw API key - only returned once at bootstrap. */
    apiKey: string;
    created: boolean;
  }>;
  resolveEnvironmentByApiKey(apiKey: string): Promise<Environment | null>;
  getLatestPolicy(environmentId: string): Promise<PolicyVersion | null>;
  publishPolicy(environmentId: string, document: PolicyDocument): Promise<PolicyVersion>;
  ingestAudit(environmentId: string, events: AuditEvent[]): Promise<number>;
  queryAudit(environmentId: string, query?: AuditQuery): Promise<StoredAuditEvent[]>;
  getProject(projectId: string): Promise<Project | null>;
  getEnvironment(environmentId: string): Promise<Environment | null>;
}
