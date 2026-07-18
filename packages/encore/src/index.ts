/**
 * @tailrace/encore - Encore.ts middleware (OpenAI-compatible passthrough).
 */

export type {
  EncoreHandlerResponse,
  EncoreMiddlewareRequest,
  EncoreRawRequest,
  EncoreRawResponse,
  TailraceEncoreOptions,
} from "./types";
export { checkEncoreOpenAiBody, tailraceEncore } from "./middleware";
