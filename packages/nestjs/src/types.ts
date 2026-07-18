/**
 * Public types for @tailrace/nestjs.
 */

import type { Decision, Tailrace } from "@tailrace/core";
import type { Request } from "express";

export interface TailraceNestOptions {
  tailrace: Tailrace;
  /** Only `"openai-compatible"` is supported in v0.1. Default. */
  mode?: "openai-compatible";
  /** Derive the acting agent from the request. Defaults to `"default"`. */
  agent?: (req: Request) => string;
  /** Static or per-request workflow id. Defaults to `"default"`. */
  workflowId?: string | ((req: Request) => string);
  onDecision?: (decisions: Decision[]) => void;
  /**
   * Route paths for `MiddlewareConsumer.apply(...).forRoutes(...)`.
   * Defaults to `{*path}` (all routes). Prefer scoping to `v1/*path` (Nest 11 /
   * path-to-regexp named splat) in production.
   */
  forRoutes?: Array<string | { path: string; method?: number }>;
}

export const TAILRACE_NEST_OPTIONS = "TAILRACE_NEST_OPTIONS" as const;
