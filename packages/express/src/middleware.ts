/**
 * tailraceExpress — OpenAI-compatible Express middleware (docs/integrations.md §10).
 */

import type { Boundary, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";
import {
  parseOpenAiBody,
  POLICY_VIOLATION_STATUS,
  policyViolationBody,
  runOpenAiCompatRequestCheck,
  wrapNodeResponse,
} from "@tailrace/http";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { resolveIdentity } from "./identity";
import type { TailraceExpressOptions } from "./types";

/**
 * Build Tailrace middleware for an Express app.
 *
 * @example
 * ```ts
 * app.use("/v1", express.json(), tailraceExpress(tailrace));
 * ```
 */
export function tailraceExpress(tailrace: Tailrace, opts?: TailraceExpressOptions): RequestHandler {
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
