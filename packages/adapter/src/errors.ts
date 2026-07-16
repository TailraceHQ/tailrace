/**
 * PolicyViolationError translation for tool surfaces.
 */

import type { Boundary } from "@tailrace/core";
import { PolicyViolationError } from "@tailrace/core";

/**
 * Format a tool-boundary block as a string the model can self-correct against
 * (docs/integrations.md §1.3 / §6). Never includes the raw value.
 *
 * @example
 * ```ts
 * throw new Error(formatToolBlockError(err));
 * ```
 */
export function formatToolBlockError(err: PolicyViolationError): string {
  const d = err.decisions[0];
  if (d === undefined) {
    return "Blocked by data policy";
  }
  return `Blocked by data policy: ${d.entity} may not be sent to ${formatBoundary(d.boundary)} (rule: ${d.rule})`;
}

function formatBoundary(boundary: Boundary): string {
  switch (boundary.kind) {
    case "model":
      return `model:${boundary.provider}`;
    case "tool":
      return `tool:${boundary.name}:${boundary.direction}`;
    case "mcp":
      return `mcp:${boundary.server}/${boundary.tool}:${boundary.direction}`;
    case "telemetry":
      return "telemetry";
    case "egress":
      return `egress:${boundary.sink}`;
    default: {
      const _exhaustive: never = boundary;
      return String(_exhaustive);
    }
  }
}

export { PolicyViolationError };
