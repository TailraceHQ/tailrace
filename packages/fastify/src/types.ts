/**
 * Public types for @tailrace/fastify.
 */

import type { Decision } from "@tailrace/core";
import type { FastifyRequest } from "fastify";

export interface TailraceFastifyOptions {
  /** Only `"openai-compatible"` is supported in v0.1. Default. */
  mode?: "openai-compatible";
  /** Derive the acting agent from the request. Defaults to `"default"`. */
  agent?: (req: FastifyRequest) => string;
  /** Static or per-request workflow id. Defaults to `"default"`. */
  workflowId?: string | ((req: FastifyRequest) => string);
  onDecision?: (decisions: Decision[]) => void;
}
