# Block secrets in a NestJS app

User-facing companion to [`integrations.md`](../integrations.md) §12. DevSite:
[Block secrets in a NestJS app](https://tailrace.dev/docs/guides/block-secrets-in-nestjs) ·
[NestJS integration](https://tailrace.dev/docs/integrations/nestjs).

## Overview

`@tailrace/nestjs` provides `TailraceModule.forRoot` + `TailraceMiddleware` for OpenAI-compatible
routes. Primary CI target: Nest + **Express** adapter.

## Installation

```bash
pnpm add @tailrace/core @tailrace/nestjs @nestjs/common @nestjs/core reflect-metadata
```

## Minimal module

```ts
import { createTailrace } from "@tailrace/core";
import { TailraceModule } from "@tailrace/nestjs";
import { Module } from "@nestjs/common";

@Module({
  imports: [
    TailraceModule.forRoot({
      tailrace: createTailrace(),
      forRoutes: ["v1/*path"],
      agent: (req) => String(req.headers["x-agent-id"] ?? "default"),
    }),
  ],
})
export class AppModule {}
```

Nest 11 route globs use named splats (`v1/*path`, not `v1*`).

## Nest + Fastify

For Nest's Fastify adapter, register [`@tailrace/fastify`](fastify-integration.md) on the
underlying Fastify instance rather than relying on Express-shaped middleware.

See [`integrations.md`](../integrations.md) §12.
