/**
 * Express-compatible request handler used by Nest middleware (Nest + Express adapter).
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import {
  parseOpenAiBody,
  POLICY_VIOLATION_STATUS,
  policyViolationBody,
  runOpenAiCompatRequestCheck,
  wrapNodeResponse,
  type OpenAiCompatIdentityOpts,
} from "@tailrace/http";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { TailraceNestOptions } from "./types";

function resolveIdentity(req: Request, opts: TailraceNestOptions): OpenAiCompatIdentityOpts {
  const identity: OpenAiCompatIdentityOpts = {
    agent: opts.agent?.(req) ?? "default",
  };
  if (opts.workflowId !== undefined) {
    identity.workflowId =
      typeof opts.workflowId === "function" ? opts.workflowId(req) : opts.workflowId;
  }
  if (opts.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  return identity;
}

export function createNestExpressHandler(opts: TailraceNestOptions): RequestHandler {
  const tailrace: Tailrace = opts.tailrace;
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const body = parseOpenAiBody(req.body);
      if (body === null) {
        next();
        return;
      }

      const identity = resolveIdentity(req, opts);
      let boundary: Boundary;
      try {
        const result = await runOpenAiCompatRequestCheck(tailrace, body, identity);
        boundary = result.boundary;
        req.body = body;
      } catch (err) {
        if (err instanceof PolicyViolationError) {
          res.status(POLICY_VIOLATION_STATUS).json(policyViolationBody(err));
          return;
        }
        next(err);
        return;
      }

      wrapNodeResponse(res, tailrace, boundary, identity, (err) => next(err));
      next();
    })().catch((err: unknown) => {
      next(err);
    });
  };
}
