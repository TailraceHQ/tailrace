> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/cloud

Hosted policy plane client for Tailrace. Ships `remotePolicy` (`PolicySource`) and
`remoteAuditSink` (`AuditSink`) so a dashboard can distribute policies and aggregate
audit events **out of band**. Nothing in `check` / `restore` waits on the network.

## Install

```bash
pnpm add @tailrace/cloud @tailrace/core
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { remoteAuditSink, remotePolicy } from "@tailrace/cloud";

const apiKey = process.env.TAILRACE_API_KEY!;
const base = process.env.TAILRACE_PLANE_URL!; // e.g. https://plane.example.com

const tailrace = createTailrace({
  policy: remotePolicy(`${base}/api/v1/policy`, { apiKey }),
  audit: {
    sinks: [remoteAuditSink(`${base}/api/v1/audit`, { apiKey })],
  },
});
```

## Behavior

| Client            | Failure mode                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `remotePolicy`    | Fail open: last-known-good in memory; cold start falls back to `defaultPolicy()` and warns. Never throws from `load()`. |
| `remoteAuditSink` | Fire-and-forget: batches events, drops on delivery failure, never throws into the host.                                 |

v1 uses poll for `subscribe` (SSE is a fast-follow). Pass full endpoint URLs - no path joining.

## Runtime

Matches `@tailrace/core`: Node 20+, Cloudflare Workers, Vercel Edge. No `node:` imports;
uses `fetch` + timers only.
