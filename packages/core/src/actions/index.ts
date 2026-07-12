/**
 * Action application and restore. Internal to core.
 */

export { applyActions, collapseOverlaps } from "./apply";
export type { ApplyContext, ApplyItem } from "./apply";
export { cloneJson, getStringAtPointer, setStringAtPointer } from "./pointer";
export { restoreInput } from "./restore";
export type { RestoreContext } from "./restore";
