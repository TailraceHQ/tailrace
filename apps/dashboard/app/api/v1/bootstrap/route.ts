import { NextResponse } from "next/server";

import { checkBootstrapAccess } from "@/lib/bootstrap-gate";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * POST /api/v1/bootstrap - ensure a demo org/project/environment exists.
 * Gated: disabled in production unless ALLOW_BOOTSTRAP=true and BOOTSTRAP_SECRET
 * is set; when a secret is configured, require matching `x-bootstrap-secret`.
 */
export async function POST(req: Request): Promise<Response> {
  const gate = checkBootstrapAccess({
    nodeEnv: process.env.NODE_ENV,
    allowBootstrap: process.env.ALLOW_BOOTSTRAP,
    bootstrapSecret: process.env.BOOTSTRAP_SECRET,
    providedSecret: req.headers.get("x-bootstrap-secret"),
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const result = await getStore().ensureBootstrap();
  const project = await getStore().getProject(result.environment.projectId);
  return NextResponse.json({
    created: result.created,
    org: { id: result.org.id, name: result.org.name },
    project: { id: result.project.id, name: result.project.name },
    environment: {
      id: result.environment.id,
      name: result.environment.name,
      apiKeyPrefix: result.environment.apiKeyPrefix,
    },
    apiKey: result.apiKey,
    projectName: project?.name ?? result.project.name,
  });
}
