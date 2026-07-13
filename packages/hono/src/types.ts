/**
 * Public types for @tailrace/hono.
 */

import type { Decision } from "@tailrace/core";
import type { Context } from "hono";

export interface TailraceHonoOptions {
  /** Only `"openai-compatible"` is supported in v0.1. Default. */
  mode?: "openai-compatible";
  /** Derive the acting agent from the request context. Defaults to `"default"`. */
  agent?: (c: Context) => string;
  /** Static or per-request workflow id. Defaults to `"default"`. */
  workflowId?: string | ((c: Context) => string);
  onDecision?: (decisions: Decision[]) => void;
}
