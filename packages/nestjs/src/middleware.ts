/**
 * NestJS middleware class wrapping the Express-compatible handler.
 */

import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

import { createNestExpressHandler } from "./handler";
import { TAILRACE_NEST_OPTIONS, type TailraceNestOptions } from "./types";

@Injectable()
export class TailraceMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof createNestExpressHandler>;

  constructor(@Inject(TAILRACE_NEST_OPTIONS) opts: TailraceNestOptions) {
    this.handler = createNestExpressHandler(opts);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res, next);
  }
}
