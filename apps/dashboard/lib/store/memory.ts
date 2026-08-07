/**
 * In-memory plane store. Default for local/demo and tests.
 * Swap for Postgres later via the same {@link PlaneStore} interface.
 */

import { defaultPolicy, type AuditEvent, type PolicyDocument } from "@tailrace/core";

import { generateApiKey, hashApiKey } from "../api-key";
import type {
  AuditQuery,
  Environment,
  Org,
  PlaneStore,
  PolicyVersion,
  Project,
  StoredAuditEvent,
} from "./types";

function id(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryPlaneStore implements PlaneStore {
  orgs = new Map<string, Org>();
  projects = new Map<string, Project>();
  environments = new Map<string, Environment>();
  policies: PolicyVersion[] = [];
  audits: StoredAuditEvent[] = [];
  private bootstrapped = false;
  private bootstrapKey: string | null = null;

  async ensureBootstrap(): Promise<{
    org: Org;
    project: Project;
    environment: Environment;
    apiKey: string;
    created: boolean;
  }> {
    if (this.bootstrapped) {
      const org = [...this.orgs.values()][0];
      const project = [...this.projects.values()][0];
      const environment = [...this.environments.values()][0];
      if (!org || !project || !environment || this.bootstrapKey === null) {
        throw new Error("bootstrap state corrupt");
      }
      return { org, project, environment, apiKey: this.bootstrapKey, created: false };
    }

    const key = await generateApiKey();
    const org: Org = { id: id("org"), name: "Demo Org", createdAt: nowIso() };
    const project: Project = {
      id: id("proj"),
      orgId: org.id,
      name: "Demo Project",
      createdAt: nowIso(),
    };
    const environment: Environment = {
      id: id("env"),
      projectId: project.id,
      name: "production",
      apiKeyHash: key.hash,
      apiKeyPrefix: key.prefix,
      createdAt: nowIso(),
    };
    this.orgs.set(org.id, org);
    this.projects.set(project.id, project);
    this.environments.set(environment.id, environment);
    this.policies.push({
      id: id("pol"),
      environmentId: environment.id,
      version: 1,
      document: defaultPolicy(),
      publishedAt: nowIso(),
    });
    this.bootstrapped = true;
    this.bootstrapKey = key.raw;
    return { org, project, environment, apiKey: key.raw, created: true };
  }

  async resolveEnvironmentByApiKey(apiKey: string): Promise<Environment | null> {
    const hash = await hashApiKey(apiKey);
    for (const env of this.environments.values()) {
      if (env.apiKeyHash === hash) return env;
    }
    return null;
  }

  async getLatestPolicy(environmentId: string): Promise<PolicyVersion | null> {
    const versions = this.policies
      .filter((p) => p.environmentId === environmentId)
      .sort((a, b) => b.version - a.version);
    return versions[0] ?? null;
  }

  async publishPolicy(environmentId: string, document: PolicyDocument): Promise<PolicyVersion> {
    const latest = await this.getLatestPolicy(environmentId);
    const version = (latest?.version ?? 0) + 1;
    const row: PolicyVersion = {
      id: id("pol"),
      environmentId,
      version,
      document,
      publishedAt: nowIso(),
    };
    this.policies.push(row);
    return row;
  }

  async ingestAudit(environmentId: string, events: AuditEvent[]): Promise<number> {
    const ingestedAt = nowIso();
    for (const event of events) {
      this.audits.push({
        id: id("aud"),
        environmentId,
        type: event.type,
        workflowId: event.workflowId,
        timestamp: event.timestamp,
        decisions: event.decisions,
        ingestedAt,
      });
    }
    return events.length;
  }

  async queryAudit(environmentId: string, query: AuditQuery = {}): Promise<StoredAuditEvent[]> {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    let rows = this.audits
      .filter((a) => a.environmentId === environmentId)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (query.entity !== undefined) {
      const entity = query.entity;
      rows = rows.filter((r) => r.decisions.some((d) => d.entity === entity));
    }
    if (query.boundaryKind !== undefined) {
      const kind = query.boundaryKind;
      rows = rows.filter((r) => r.decisions.some((d) => d.boundary.kind === kind));
    }
    if (query.identity !== undefined) {
      const agent = query.identity;
      rows = rows.filter((r) => r.decisions.some((d) => d.identity.agent === agent));
    }
    if (query.rule !== undefined) {
      const rule = query.rule;
      rows = rows.filter((r) => r.decisions.some((d) => d.rule.includes(rule)));
    }
    if (query.contentHash !== undefined) {
      const hash = query.contentHash;
      rows = rows.filter((r) => r.decisions.some((d) => d.contentHash === hash));
    }

    return rows.slice(offset, offset + limit);
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) ?? null;
  }

  async getEnvironment(environmentId: string): Promise<Environment | null> {
    return this.environments.get(environmentId) ?? null;
  }
}
