# @tailrace/mcp

Policy enforcement for [MCP](https://modelcontextprotocol.io) client transports
(`@modelcontextprotocol/sdk` `>=1`). Wrap a transport so outbound `tools/call` arguments and
inbound tool / `resources/read` results pass through Tailrace before they leave the process.

A blocked call becomes a JSON-RPC error (`code: -32001`) instead of tearing down the transport.

## Install

```bash
pnpm add @tailrace/core @tailrace/mcp @modelcontextprotocol/sdk
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { withMcp } from "@tailrace/mcp";

const tailrace = withMcp(createTailrace());
const transport = tailrace.transport(sseTransport, { server: "salesforce" });
// Pass `transport` to the MCP Client - secrets never reach the server.
```

Standalone form: `wrapTransport(tailrace, transport, { server: "salesforce" })`.

## What gets scanned

| Direction | Method                  | Boundary                                                 |
| --------- | ----------------------- | -------------------------------------------------------- |
| Out       | `tools/call` arguments  | `{ kind: "mcp", server, tool: name, direction: "out" }`  |
| In        | `tools/call` result     | same with `direction: "in"`                              |
| In        | `resources/read` result | `{ kind: "mcp", server, tool: "read", direction: "in" }` |

All other JSON-RPC messages pass through. Spec: [`docs/integrations.md`](../../docs/integrations.md) §2.
Guide: [`docs/guides/mcp-integration.md`](../../docs/guides/mcp-integration.md).
