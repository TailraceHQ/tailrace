/**
 * runGoverned — generic preflight check → handler → optional result check.
 */

import type { Boundary, Decision, Tailrace } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";

import { asCheckable, unwrapCheckable } from "./checkable";
import { checkWithOpts } from "./context";
import { formatToolBlockError } from "./errors";
import type { GovernedInvocation, GovernedResult } from "./types";

function flipToolOrMcpDirection(boundary: Boundary): Boundary {
  if (boundary.kind === "tool") {
    return {
      kind: "tool",
      name: boundary.name,
      direction: boundary.direction === "out" ? "in" : "out",
    };
  }
  if (boundary.kind === "mcp") {
    return {
      kind: "mcp",
      server: boundary.server,
      tool: boundary.tool,
      direction: boundary.direction === "out" ? "in" : "out",
    };
  }
  return boundary;
}

/**
 * Run a handler under a preflight policy check on `invocation.input`.
 *
 * @example
 * ```ts
 * const result = await runGoverned(
 *   tailrace,
 *   { boundary: { kind: "tool", name: "crm", direction: "out" }, input: args },
 *   async () => execute(args),
 * );
 * ```
 */
export async function runGoverned<TOutput>(
  tailrace: Tailrace,
  invocation: GovernedInvocation,
  handler: (checkedInput: unknown) => Promise<TOutput> | TOutput,
): Promise<GovernedResult<TOutput>> {
  const opts: {
    agent?: string;
    workflowId?: string | (() => string);
    onDecision?: (decisions: Decision[]) => void;
  } = {};
  if (invocation.agent !== undefined) opts.agent = invocation.agent;
  if (invocation.workflowId !== undefined) opts.workflowId = invocation.workflowId;
  if (invocation.onDecision !== undefined) opts.onDecision = invocation.onDecision;
  const decisions: Decision[] = [];

  let checkedInput: unknown = invocation.input;
  try {
    const { output, decisions: d } = await checkWithOpts(
      tailrace,
      asCheckable(invocation.input),
      invocation.boundary,
      opts,
    );
    decisions.push(...d);
    checkedInput = unwrapCheckable(invocation.input, output);
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      decisions.push(...err.decisions);
      return {
        allowed: false,
        error: formatToolBlockError(err),
        decisions,
      };
    }
    throw err;
  }

  let output: TOutput;
  try {
    output = await handler(checkedInput);
  } catch (err) {
    return {
      allowed: true,
      error: err instanceof Error ? err.message : "Unknown handler error",
      decisions,
    };
  }

  if (invocation.checkResult === true) {
    const resultBoundary = flipToolOrMcpDirection(invocation.boundary);
    try {
      const { output: checked, decisions: d } = await checkWithOpts(
        tailrace,
        asCheckable(output),
        resultBoundary,
        opts,
      );
      decisions.push(...d);
      return {
        allowed: true,
        output: unwrapCheckable(output, checked) as TOutput,
        decisions,
      };
    } catch (err) {
      if (err instanceof PolicyViolationError) {
        decisions.push(...err.decisions);
        return {
          allowed: false,
          error: formatToolBlockError(err),
          decisions,
        };
      }
      throw err;
    }
  }

  return { allowed: true, output, decisions };
}
