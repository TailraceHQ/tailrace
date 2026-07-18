/**
 * Public types for @tailrace/express.
 */

import type { Decision } from "@tailrace/core";
import type { Request } from "express";

export interface TailraceExpressOptions {
  /** Only `"openai-compatible"` is supported in v0.1. Default. */
  mode?: "openai-compatible";
  /** Derive the acting agent from the request. Defaults to `"default"`. */
  agent?: (req: Request) => string;
  /** Static or per-request workflow id. Defaults to `"default"`. */
  workflowId?: string | ((req: Request) => string);
  onDecision?: (decisions: Decision[]) => void;
}
