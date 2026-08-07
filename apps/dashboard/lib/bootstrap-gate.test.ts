import { describe, expect, it } from "vitest";

import { checkBootstrapAccess } from "./bootstrap-gate";

describe("checkBootstrapAccess", () => {
  it("allows local MVP without a secret", () => {
    expect(
      checkBootstrapAccess({
        nodeEnv: "development",
        allowBootstrap: undefined,
        bootstrapSecret: undefined,
        providedSecret: null,
      }),
    ).toEqual({ ok: true });
  });

  it("requires matching x-bootstrap-secret when BOOTSTRAP_SECRET is set", () => {
    expect(
      checkBootstrapAccess({
        nodeEnv: "development",
        allowBootstrap: undefined,
        bootstrapSecret: "dev-secret",
        providedSecret: null,
      }),
    ).toEqual({ ok: false, status: 401, error: "unauthorized" });

    expect(
      checkBootstrapAccess({
        nodeEnv: "development",
        allowBootstrap: undefined,
        bootstrapSecret: "dev-secret",
        providedSecret: "wrong",
      }),
    ).toEqual({ ok: false, status: 401, error: "unauthorized" });

    expect(
      checkBootstrapAccess({
        nodeEnv: "development",
        allowBootstrap: undefined,
        bootstrapSecret: "dev-secret",
        providedSecret: "dev-secret",
      }),
    ).toEqual({ ok: true });
  });

  it("disables bootstrap in production unless ALLOW_BOOTSTRAP and secret are set", () => {
    expect(
      checkBootstrapAccess({
        nodeEnv: "production",
        allowBootstrap: undefined,
        bootstrapSecret: undefined,
        providedSecret: null,
      }),
    ).toEqual({ ok: false, status: 403, error: "bootstrap_disabled" });

    expect(
      checkBootstrapAccess({
        nodeEnv: "production",
        allowBootstrap: "true",
        bootstrapSecret: undefined,
        providedSecret: null,
      }),
    ).toEqual({ ok: false, status: 403, error: "bootstrap_disabled" });

    expect(
      checkBootstrapAccess({
        nodeEnv: "production",
        allowBootstrap: "true",
        bootstrapSecret: "prod-secret",
        providedSecret: "prod-secret",
      }),
    ).toEqual({ ok: true });
  });
});
