import { NextResponse } from "next/server";

import { AuditQueryError, parseAuditQuery } from "@/lib/audit-query";
import { authenticateRequest } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { parseAuditBatch } from "@/lib/validate-audit";

export const runtime = "nodejs";

/**
 * POST /api/v1/audit - ingest a batch of AuditEvents (contentHash only; no raw values).
 */
export async function POST(req: Request): Promise<Response> {
  const env = await authenticateRequest(req);
  if (env === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let events;
  try {
    events = parseAuditBatch(body);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_audit",
        message: err instanceof Error ? err.message : "invalid audit batch",
      },
      { status: 400 },
    );
  }

  const accepted = await getStore().ingestAudit(env.id, events);
  return NextResponse.json({ accepted }, { status: 202 });
}

/**
 * GET /api/v1/audit - list/filter audit events for the dashboard.
 * Query: entity, boundaryKind, identity, rule, contentHash, limit, offset
 */
export async function GET(req: Request): Promise<Response> {
  const env = await authenticateRequest(req);
  if (env === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let q;
  try {
    q = parseAuditQuery(url.searchParams);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_query",
        message: err instanceof AuditQueryError ? err.message : "invalid query",
      },
      { status: 400 },
    );
  }

  const events = await getStore().queryAudit(env.id, q);
  return NextResponse.json({ events });
}
