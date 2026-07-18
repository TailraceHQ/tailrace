> **Tailrace** - Agent data governance for TypeScript. [Docs](https://tailrace.dev) · [All packages](https://www.npmjs.com/org/tailrace) · [@tailrace/core](https://www.npmjs.com/package/@tailrace/core)

# @tailrace/nestjs

Policy enforcement for [NestJS](https://nestjs.com) (`@nestjs/common` `>=10`). OpenAI-compatible
passthrough at the model boundary. Primary target: Nest + **Express** adapter.

## Install

```bash
pnpm add @tailrace/core @tailrace/nestjs @nestjs/common @nestjs/core reflect-metadata
```

## Quickstart

```ts
import { createTailrace } from "@tailrace/core";
import { TailraceModule } from "@tailrace/nestjs";
import { Module } from "@nestjs/common";

@Module({
  imports: [TailraceModule.forRoot({ tailrace: createTailrace(), forRoutes: ["v1/*path"] })],
})
export class AppModule {}
```

For Nest + Fastify, register `@tailrace/fastify` on the Fastify instance instead.
Docs: [NestJS](https://tailrace.dev/docs/integrations/nestjs) ·
[Guide](https://tailrace.dev/docs/guides/block-secrets-in-nestjs).
Spec: [`docs/integrations.md`](../../docs/integrations.md) §12.
