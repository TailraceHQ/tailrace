/**
 * @tailrace/ai-sdk — Vercel AI SDK middleware (flagship integration).
 *
 * Integrations contain zero policy logic: they build a `Boundary`/`Identity`, call
 * `check`/`restore`, and translate `PolicyViolationError` into the host's failure mode
 * (docs/integrations.md §1).
 */

export type { AiSdkWrapOptions, StreamBlockBehavior, TailraceWithAiSdk } from "./types";
export { wrapModel } from "./wrap-model";
export { wrapTools } from "./wrap-tools";
export { withAiSdk } from "./fluent";
export { encodeModelProvider } from "./internal/provider";
