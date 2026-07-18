/**
 * TailraceModule.forRoot — NestJS dynamic module (docs/integrations.md §12).
 */

import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";

import { TailraceMiddleware } from "./middleware";
import { TAILRACE_NEST_OPTIONS, type TailraceNestOptions } from "./types";

@Module({})
export class TailraceModule implements NestModule {
  private static routes: Array<string | { path: string; method?: number }> = ["{*path}"];

  /**
   * Register Tailrace openai-compat middleware for Nest (Express adapter primary).
   *
   * @example
   * ```ts
   * TailraceModule.forRoot({ tailrace, forRoutes: [{ path: "v1/*path", method: RequestMethod.ALL }] })
   * ```
   */
  static forRoot(options: TailraceNestOptions): DynamicModule {
    TailraceModule.routes = options.forRoutes ?? ["{*path}"];
    return {
      module: TailraceModule,
      providers: [{ provide: TAILRACE_NEST_OPTIONS, useValue: options }, TailraceMiddleware],
      exports: [TailraceMiddleware, TAILRACE_NEST_OPTIONS],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const routes = TailraceModule.routes.map((route) => {
      if (typeof route === "string") return route;
      return { path: route.path, method: route.method ?? RequestMethod.ALL };
    });
    consumer.apply(TailraceMiddleware).forRoutes(...routes);
  }
}
