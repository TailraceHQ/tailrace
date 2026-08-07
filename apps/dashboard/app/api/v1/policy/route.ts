import { definePolicy, type PolicyDocument } from "@tailrace/core";
import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * GET /api/v1/policy - latest published policy for the API key's environment.
 */
export async function GET(req: Request): Promise<Response> {
  const env = await authenticateRequest(req);
  if (env === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const store = getStore();
  const latest = await store.getLatestPolicy(env.id);
  if (latest === null) {
    return NextResponse.json({ error: "no_policy" }, { status: 404 });
  }

  return NextResponse.json(
    {
      version: latest.version,
      document: latest.document,
      publishedAt: latest.publishedAt,
    },
    {
      headers: {
        ETag: `"v${String(latest.version)}"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * POST /api/v1/policy - publish a new policy version (validated via definePolicy).
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

  const documentRaw =
    typeof body === "object" && body !== null && "document" in body
      ? (body as { document: unknown }).document
      : body;

  let document: PolicyDocument;
  try {
    document = definePolicy(documentRaw as PolicyDocument);
  } catch (err) {
    return NextResponse.json(
      {
        error: "invalid_policy",
        message: err instanceof Error ? err.message : "policy validation failed",
      },
      { status: 400 },
    );
  }

  const published = await getStore().publishPolicy(env.id, document);
  return NextResponse.json(
    {
      version: published.version,
      document: published.document,
      publishedAt: published.publishedAt,
    },
    { status: 201 },
  );
}
