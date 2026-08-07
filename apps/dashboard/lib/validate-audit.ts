/**
 * Reconstruct audit payloads from known-safe fields only.
 * No code path may persist client-supplied keys that could carry raw entity values.
 */

import type { Action, AuditEvent, Boundary, Decision, Identity } from "@tailrace/core";

const ACTIONS = new Set<string>([
  "allow",
  "mask",
  "tokenize",
  "block",
  "review",
  "detokenize",
  "restore_miss",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBoundary(raw: unknown, path: string): Boundary {
  if (!isRecord(raw)) {
    throw new Error(`${path}: boundary must be an object`);
  }
  const kind = raw.kind;
  if (typeof kind !== "string") {
    throw new Error(`${path}: boundary.kind required`);
  }
  switch (kind) {
    case "model": {
      if (typeof raw.provider !== "string") {
        throw new Error(`${path}: boundary.provider required for kind model`);
      }
      return { kind: "model", provider: raw.provider };
    }
    case "tool": {
      if (typeof raw.name !== "string") {
        throw new Error(`${path}: boundary.name required for kind tool`);
      }
      if (raw.direction !== "in" && raw.direction !== "out") {
        throw new Error(`${path}: boundary.direction must be in|out for kind tool`);
      }
      return { kind: "tool", name: raw.name, direction: raw.direction };
    }
    case "mcp": {
      if (typeof raw.server !== "string") {
        throw new Error(`${path}: boundary.server required for kind mcp`);
      }
      if (typeof raw.tool !== "string") {
        throw new Error(`${path}: boundary.tool required for kind mcp`);
      }
      if (raw.direction !== "in" && raw.direction !== "out") {
        throw new Error(`${path}: boundary.direction must be in|out for kind mcp`);
      }
      return {
        kind: "mcp",
        server: raw.server,
        tool: raw.tool,
        direction: raw.direction,
      };
    }
    case "telemetry":
      return { kind: "telemetry" };
    case "egress": {
      if (typeof raw.sink !== "string") {
        throw new Error(`${path}: boundary.sink required for kind egress`);
      }
      return { kind: "egress", sink: raw.sink };
    }
    default:
      throw new Error(`${path}: unknown boundary.kind`);
  }
}

function parseIdentity(raw: unknown, path: string): Identity {
  if (!isRecord(raw)) {
    throw new Error(`${path}: identity must be an object`);
  }
  if (typeof raw.agent !== "string" || raw.agent.length === 0) {
    throw new Error(`${path}: identity.agent required`);
  }
  // Drop claims and any other keys - claims are not needed for plane audit UI and
  // must not become a vector for arbitrary client data.
  return { agent: raw.agent };
}

function parseSpan(raw: unknown, path: string): { path: string; start: number; end: number } {
  if (!isRecord(raw)) {
    throw new Error(`${path}: span is required`);
  }
  if (typeof raw.path !== "string") {
    throw new Error(`${path}: span.path required`);
  }
  if (typeof raw.start !== "number" || !Number.isFinite(raw.start)) {
    throw new Error(`${path}: span.start must be a number`);
  }
  if (typeof raw.end !== "number" || !Number.isFinite(raw.end)) {
    throw new Error(`${path}: span.end must be a number`);
  }
  return { path: raw.path, start: raw.start, end: raw.end };
}

function parseDecision(raw: unknown, path: string): Decision {
  if (!isRecord(raw)) {
    throw new Error(`${path}: decision must be an object`);
  }
  if (typeof raw.action !== "string" || !ACTIONS.has(raw.action)) {
    throw new Error(`${path}: action must be a known Action`);
  }
  if (typeof raw.entity !== "string" || raw.entity.length === 0) {
    throw new Error(`${path}: entity required`);
  }
  if (typeof raw.rule !== "string") {
    throw new Error(`${path}: rule required`);
  }
  if (typeof raw.contentHash !== "string" || !/^[a-f0-9]{64}$/i.test(raw.contentHash)) {
    throw new Error(`${path}: contentHash must be a 64-char hex SHA-256`);
  }

  const decision: Decision = {
    action: raw.action as Action | "restore_miss",
    entity: raw.entity,
    boundary: parseBoundary(raw.boundary, `${path}.boundary`),
    identity: parseIdentity(raw.identity, `${path}.identity`),
    rule: raw.rule,
    span: parseSpan(raw.span, `${path}.span`),
    contentHash: raw.contentHash.toLowerCase(),
  };

  if (raw.appliedAs === "mask") {
    decision.appliedAs = "mask";
  } else if (raw.appliedAs !== undefined) {
    throw new Error(`${path}: appliedAs must be "mask" when present`);
  }

  return decision;
}

/**
 * Parse and validate an audit batch. Reconstructs allowlisted fields only; throws on
 * malformed or incomplete payloads.
 */
export function parseAuditBatch(body: unknown): AuditEvent[] {
  if (!isRecord(body) || !Array.isArray(body.events)) {
    throw new Error("body must be { events: AuditEvent[] }");
  }
  const events: AuditEvent[] = [];
  for (let i = 0; i < body.events.length; i++) {
    const event = body.events[i];
    const path = `events[${String(i)}]`;
    if (!isRecord(event)) throw new Error(`${path}: must be an object`);
    if (event.type !== "check" && event.type !== "restore") {
      throw new Error(`${path}: type must be check|restore`);
    }
    if (typeof event.workflowId !== "string") {
      throw new Error(`${path}: workflowId required`);
    }
    if (typeof event.timestamp !== "number" || !Number.isFinite(event.timestamp)) {
      throw new Error(`${path}: timestamp required`);
    }
    if (!Array.isArray(event.decisions)) {
      throw new Error(`${path}: decisions must be an array`);
    }
    const decisions: Decision[] = [];
    for (let j = 0; j < event.decisions.length; j++) {
      decisions.push(parseDecision(event.decisions[j], `${path}.decisions[${String(j)}]`));
    }
    events.push({
      type: event.type,
      workflowId: event.workflowId,
      timestamp: event.timestamp,
      decisions,
    });
  }
  return events;
}
