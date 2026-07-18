import type { OpenAiCompatIdentityOpts } from "@tailrace/http";
import type { Request } from "express";

import type { TailraceExpressOptions } from "./types";

export function resolveIdentity(
  req: Request,
  opts?: TailraceExpressOptions,
): OpenAiCompatIdentityOpts {
  const identity: OpenAiCompatIdentityOpts = {
    agent: opts?.agent?.(req) ?? "default",
  };
  if (opts?.workflowId !== undefined) {
    identity.workflowId =
      typeof opts.workflowId === "function" ? opts.workflowId(req) : opts.workflowId;
  }
  if (opts?.onDecision !== undefined) {
    identity.onDecision = opts.onDecision;
  }
  return identity;
}
