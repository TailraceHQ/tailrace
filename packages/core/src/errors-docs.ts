/**
 * Append a stable docs URL for the error code (docs/site/machine-readable.md §4).
 */

const DOCS_ERRORS_BASE = "https://tailrace.dev/docs/reference/errors";

export function withDocsUrl(code: string, message: string): string {
  const suffix = `→ ${DOCS_ERRORS_BASE}/${code}`;
  if (message.includes(suffix) || message.includes(`${DOCS_ERRORS_BASE}/${code}`)) {
    return message;
  }
  return `${message} ${suffix}`;
}

export function docsUrlForCode(code: string): string {
  return `${DOCS_ERRORS_BASE}/${code}`;
}
