/**
 * @tailrace/hono - Hono middleware (OpenAI-compatible passthrough).
 *
 * Parses OpenAI-format chat bodies, applies policy at the model boundary, forwards, and
 * scans responses (including SSE streaming). A block becomes a 422 JSON error
 * (docs/integrations.md §3).
 */

export type { TailraceHonoOptions } from "./types";
export { tailraceHono } from "./middleware";
