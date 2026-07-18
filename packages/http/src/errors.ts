/**
 * 422 policy_violation body builder (docs/integrations.md §3 / §9). Never includes raw values.
 */

import type { PolicyViolationError } from "@tailrace/core";

export interface PolicyViolationBody {
  error: {
    type: "policy_violation";
    entity: string;
    rule: string;
  };
}

export function policyViolationBody(err: PolicyViolationError): PolicyViolationBody {
  const first = err.decisions[0];
  return {
    error: {
      type: "policy_violation",
      entity: first?.entity ?? "unknown",
      rule: first?.rule ?? "unknown",
    },
  };
}

export const POLICY_VIOLATION_STATUS = 422 as const;
