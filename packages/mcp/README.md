# @tailrace/mcp

Tailrace wrapper for [MCP](https://modelcontextprotocol.io) client transports. Applies policy to
outbound `tools/call` arguments and inbound tool/resource results; a blocked call becomes a JSON-RPC
error result instead of tearing down the transport.

> **M0 skeleton.** `wrapTransport` throws `NotImplementedError` until milestone M5
> (see [`docs/milestones.md`](../../docs/milestones.md)).

`@modelcontextprotocol/sdk` is a peer dependency.
