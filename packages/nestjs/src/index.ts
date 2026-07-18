/**
 * @tailrace/nestjs - NestJS middleware module (OpenAI-compatible passthrough).
 *
 * Primary CI target: Nest + Express adapter. For Nest + Fastify, prefer
 * `@tailrace/fastify` registered on the underlying Fastify instance, or apply
 * the same openai-compat contract via a custom Nest middleware that delegates
 * to `@tailrace/http`.
 */

export type { TailraceNestOptions } from "./types";
export { TAILRACE_NEST_OPTIONS } from "./types";
export { TailraceMiddleware } from "./middleware";
export { TailraceModule } from "./module";
