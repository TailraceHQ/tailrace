# Guide: NestJS middleware module

User-facing companion to [`integrations.md`](../integrations.md) §12. Plan: [`m9-plan.md`](../m9-plan.md).

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

## Nest + Fastify

For Nest's Fastify adapter, register [`@tailrace/fastify`](fastify-integration.md) on the
underlying Fastify instance rather than relying on Express-shaped middleware.

See [`integrations.md`](../integrations.md) §12.
