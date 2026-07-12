/**
 * Normalize a bare Action or EntityRule into a full EntityRule object.
 */

import type { EntityRule, EntityRuleValue } from "../types";

/** Expand `EntityRuleValue` to a concrete {@link EntityRule}. */
export function normalizeRule(value: EntityRuleValue): EntityRule {
  if (typeof value === "string") {
    return { action: value };
  }
  return {
    action: value.action,
    ...(value.format !== undefined ? { format: value.format } : {}),
    ...(value.dangerouslyAllowSecrets !== undefined
      ? { dangerouslyAllowSecrets: value.dangerouslyAllowSecrets }
      : {}),
  };
}
