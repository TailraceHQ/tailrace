# Tailrace Plane (`@tailrace/dashboard`)

Hosted policy plane MVP: versioned policy publish, audit ingest, and a thin dashboard.
Consumers use [`@tailrace/cloud`](../../packages/cloud) (`remotePolicy` / `remoteAuditSink`).

> Not a publishable package. Private app in the monorepo. See
> `docs/policy-plane-mvp-scope.md` for product scope (do not commit that file).

## Run locally

```bash
pnpm --filter @tailrace/dashboard dev
# http://localhost:3100
```

1. Open the UI → **Create demo project** (or paste an API key).
2. Wire agents:

```ts
import { createTailrace } from "@tailrace/core";
import { remoteAuditSink, remotePolicy } from "@tailrace/cloud";

const apiKey = process.env.TAILRACE_API_KEY!;
const base = "http://localhost:3100";

export const tailrace = createTailrace({
  policy: remotePolicy(`${base}/api/v1/policy`, { apiKey }),
  audit: { sinks: [remoteAuditSink(`${base}/api/v1/audit`, { apiKey })] },
});
```

## Bootstrap gate

`POST /api/v1/bootstrap` mints a fully-privileged environment API key. It is **not** safe to leave open on a shared deploy.

| Environment                 | Behavior                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Non-production (`next dev`) | Allowed. If `BOOTSTRAP_SECRET` is set, require header `x-bootstrap-secret: <secret>`.                               |
| Production                  | Disabled (403) unless **both** `ALLOW_BOOTSTRAP=true` and `BOOTSTRAP_SECRET` are set; then require the same header. |

```bash
# Local with an explicit secret
BOOTSTRAP_SECRET=dev-only curl -X POST http://localhost:3100/api/v1/bootstrap \
  -H "x-bootstrap-secret: dev-only"

# Never enable on a shared deploy without a strong secret
ALLOW_BOOTSTRAP=true BOOTSTRAP_SECRET=<strong-secret> …
```

Prefer creating keys out-of-band in any real deployment; treat bootstrap as a local/demo escape hatch only.

## API

| Method | Path                | Auth                       | Purpose                                                                                               |
| ------ | ------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/policy`    | Bearer API key             | Latest policy envelope `{ version, document, publishedAt }`                                           |
| `POST` | `/api/v1/policy`    | Bearer                     | Publish `{ document }` (validated with `definePolicy`)                                                |
| `POST` | `/api/v1/audit`     | Bearer                     | Ingest `{ events: AuditEvent[] }` (allowlisted Decision fields only)                                  |
| `GET`  | `/api/v1/audit`     | Bearer                     | Dashboard query (`entity`, `boundaryKind`, `identity`, `rule`, `contentHash`, `limit`≤1000, `offset`) |
| `POST` | `/api/v1/bootstrap` | Bootstrap gate (see above) | Demo org/project/environment + API key                                                                |

## Data store

Default: in-memory (`MemoryPlaneStore`) so CI and local demos need no database.
Postgres schema for Neon/Vercel Postgres: [`lib/store/schema.sql`](lib/store/schema.sql).
Swap via the `PlaneStore` interface when `DATABASE_URL` is wired.

## Constraints

- Request hot path stays in-process: this service is out-of-band only.
- Audit storage is contentHash-only; the UI has no affordance for raw values.
- One API key per environment; no RBAC/SSO in this MVP.
