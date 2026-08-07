/**
 * Bootstrap mints a fully-privileged API key. It must never be reachable
 * unauthenticated on a shared/deployed build.
 *
 * - Production: disabled unless ALLOW_BOOTSTRAP=true and BOOTSTRAP_SECRET is set;
 *   callers must send matching `x-bootstrap-secret`.
 * - Non-production: allowed without a secret for local MVP; if BOOTSTRAP_SECRET
 *   is set, the same header check applies.
 */

export type BootstrapGateResult = { ok: true } | { ok: false; status: 401 | 403; error: string };

export function checkBootstrapAccess(opts: {
  nodeEnv: string | undefined;
  allowBootstrap: string | undefined;
  bootstrapSecret: string | undefined;
  providedSecret: string | null;
}): BootstrapGateResult {
  const isProd = opts.nodeEnv === "production";
  const allowFlag = opts.allowBootstrap === "true";
  const secret =
    opts.bootstrapSecret !== undefined && opts.bootstrapSecret.length > 0
      ? opts.bootstrapSecret
      : null;

  if (isProd && !allowFlag) {
    return { ok: false, status: 403, error: "bootstrap_disabled" };
  }

  if (secret === null) {
    if (isProd) {
      // ALLOW_BOOTSTRAP alone is not enough - a secret is required in production.
      return { ok: false, status: 403, error: "bootstrap_disabled" };
    }
    return { ok: true };
  }

  if (opts.providedSecret !== secret) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
