/**
 * Policy engine: default document, validation, compile, and resolve.
 * Internal to core - consumed by createTailrace / definePolicy.
 */

export { boundaryKey, globMatch, isEgressBoundaryKey, matchBoundaryPatterns } from "./boundary";
export { compilePolicy } from "./compile";
export type { CompiledBoundary, CompiledIdentity, CompiledPolicy } from "./compile";
export { defaultPolicy } from "./default";
export { normalizeRule } from "./normalize";
export { ACTION_RANK, moreRestrictive, resolve } from "./resolve";
export type { ResolvedRule } from "./resolve";
export { validatePolicy } from "./validate";
