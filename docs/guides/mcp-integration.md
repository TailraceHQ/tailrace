# Guide: Govern MCP tool calls

User-facing companion to [`integrations.md`](../integrations.md) §2. For acceptance criteria see [`milestones.md`](../milestones.md) §M5.

## Overview

`@tailrace/mcp` wraps an MCP client `Transport`. It does not implement policy rules - it constructs `Boundary` / `Identity`, calls `tailrace.check`, and turns `PolicyViolationError` into a JSON-RPC error (`code: -32001`) without closing the transport.

```
MCP Client → wrapTransport → check (out) → server
                    ↑              ↓
              onmessage ← check (in) ← result
```

## Installation

```bash
pnpm add @tailrace/core @tailrace/mcp @modelcontextprotocol/sdk
```

Peer: `@modelcontextprotocol/sdk` `>=1`.

## Minimal wrap

```ts
import { createTailrace } from "@tailrace/core";
import { withMcp } from "@tailrace/mcp";

const tailrace = withMcp(createTailrace());
const transport = tailrace.transport(sseTransport, {
  server: "salesforce",
  agent: "support-bot",
  workflowId: sessionId,
});
```

Standalone: `wrapTransport(tailrace, transport, { server: "salesforce" })`.

## Intercepted methods

| Direction | Method | Boundary |
| --- | --- | --- |
| Out | `tools/call` arguments | `{ kind: "mcp", server, tool: name, direction: "out" }` |
| In | `tools/call` result | `direction: "in"` |
| In | `resources/read` result | `tool: "read"`, `direction: "in"` |

## Policy tip

Target MCP tools with prefixed keys:

```ts
definePolicy({
  boundaries: {
    "mcp:salesforce/*": { entities: { email: "tokenize" } },
    "mcp:salesforce/update": { entities: { api_key: "block" } },
  },
});
```

See [`integrations.md`](../integrations.md) §2 for the error payload shape.
