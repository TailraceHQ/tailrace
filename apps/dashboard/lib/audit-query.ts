/**
 * Parse GET /api/v1/audit query params. Caps limit; rejects invalid numbers.
 */

import type { AuditQuery } from "./store/types";

/** Default page size when `limit` is omitted (matches MemoryPlaneStore). */
export const DEFAULT_AUDIT_LIMIT = 100;

/** Hard cap on `limit` to keep list queries bounded. */
export const MAX_AUDIT_LIMIT = 1000;

export class AuditQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditQueryError";
  }
}

function parseNonNegInt(raw: string | null, name: string): number | undefined {
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new AuditQueryError(`${name} must be a non-negative integer`);
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) {
    throw new AuditQueryError(`${name} must be a non-negative integer`);
  }
  return n;
}

/**
 * Build an {@link AuditQuery} from URLSearchParams. Throws {@link AuditQueryError}
 * for invalid limit/offset.
 */
export function parseAuditQuery(params: URLSearchParams): AuditQuery {
  const limitRaw = parseNonNegInt(params.get("limit"), "limit");
  const offsetRaw = parseNonNegInt(params.get("offset"), "offset");

  let limit = limitRaw ?? DEFAULT_AUDIT_LIMIT;
  if (limit < 1) {
    throw new AuditQueryError("limit must be >= 1");
  }
  if (limit > MAX_AUDIT_LIMIT) {
    limit = MAX_AUDIT_LIMIT;
  }

  const offset = offsetRaw ?? 0;

  return {
    ...(params.get("entity") !== null ? { entity: params.get("entity")! } : {}),
    ...(params.get("boundaryKind") !== null ? { boundaryKind: params.get("boundaryKind")! } : {}),
    ...(params.get("identity") !== null ? { identity: params.get("identity")! } : {}),
    ...(params.get("rule") !== null ? { rule: params.get("rule")! } : {}),
    ...(params.get("contentHash") !== null ? { contentHash: params.get("contentHash")! } : {}),
    limit,
    offset,
  };
}
