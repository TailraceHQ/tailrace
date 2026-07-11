# @tailrace/hono

Tailrace middleware for [Hono](https://hono.dev). OpenAI-compatible passthrough: parses chat request
bodies, applies policy at the model boundary, and scans responses (including SSE streaming). A blocked
request returns `422` with `{ error: { type: "policy_violation", entity, rule } }`.

> **M0 skeleton.** `tailraceHono` throws `NotImplementedError` until milestone M5
> (see [`docs/milestones.md`](../../docs/milestones.md)).

`hono` is a peer dependency.
