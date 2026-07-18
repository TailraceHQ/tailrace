/**
 * @tailrace/trpc - tRPC procedure middleware (tool boundary).
 */

export type {
  TailraceTrpcMiddleware,
  TailraceTrpcOptions,
  TailraceWithTrpc,
  TrpcMiddlewareContext,
} from "./types";
export { createTailraceMiddleware } from "./middleware";
export { withTrpc } from "./fluent";
