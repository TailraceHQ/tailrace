/**
 * Canonical public origin for absolute URLs in llms.txt, MCP install snippets, and schemas.
 * Override with NEXT_PUBLIC_SITE_URL in preview / local builds.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tailrace.dev").replace(
  /\/$/,
  "",
);

export const MCP_URL = `${SITE_URL}/mcp`;
export const LLMS_TXT_URL = `${SITE_URL}/llms.txt`;
export const POLICY_SCHEMA_URL = `${SITE_URL}/schema/policy.v1.json`;

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** HTML docs path → raw markdown alternate path. */
export function markdownUrlForDocsPath(docsPath: string): string {
  const path = docsPath.endsWith("/") ? docsPath.slice(0, -1) : docsPath;
  return `${path}.md`;
}
