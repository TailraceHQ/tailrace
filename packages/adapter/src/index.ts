/**
 * @tailrace/adapter — shared integration helpers (docs/integrations.md §6).
 *
 * Zero host peers. Integrations construct Boundary/Identity, call check/restore,
 * and translate PolicyViolationError. This package only provides the shared glue.
 */

export type { AdapterWrapOptions, GovernedInvocation, GovernedResult } from "./types";
export { asCheckable, unwrapCheckable } from "./checkable";
export { formatToolBlockError, PolicyViolationError } from "./errors";
export { wrapToolExecute } from "./wrap-tool-execute";
export type { ToolExecuteFn } from "./wrap-tool-execute";
export { runGoverned } from "./run-governed";
export { buildCheckContext, checkWithOpts, resolveWorkflowId } from "./context";
