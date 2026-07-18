/**
 * NestJS + Express adapter: request 422 / tokenize / JSON response.
 */

import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { createTailrace, memoryVault } from "@tailrace/core";
import { Controller, Module, Post, Body, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { TailraceModule } from "./module";

const SECRET = "sk_test_" + "51FakeKeyForTailraceTests000FAKE";
const EMAIL = "nestjs@example.com";

function chatBody(text: string, model = "gpt-4o"): object {
  return {
    model,
    messages: [{ role: "user", content: text }],
  };
}

@Controller("v1")
class ChatController {
  @Post("chat/completions")
  completions(@Body() body: { messages?: Array<{ content?: string }> }) {
    const content = body.messages?.[0]?.content ?? "";
    // Echo path for request tokenize tests; secret/email response tests override via module.
    return { choices: [{ message: { role: "assistant", content: "ok" } }], echo: content };
  }
}

async function makeApp(
  tailrace: ReturnType<typeof createTailrace>,
  opts?: { responseContent?: string; workflowId?: string },
): Promise<INestApplication> {
  @Controller("v1")
  class DynamicController {
    @Post("chat/completions")
    completions(@Body() body: { messages?: Array<{ content?: string }> }) {
      if (opts?.responseContent !== undefined) {
        return {
          choices: [{ message: { role: "assistant", content: opts.responseContent } }],
        };
      }
      return {
        choices: [{ message: { role: "assistant", content: "ok" } }],
        echo: body.messages?.[0]?.content ?? "",
      };
    }
  }

  @Module({
    imports: [
      TailraceModule.forRoot({
        tailrace,
        forRoutes: ["v1/*path"],
        ...(opts?.workflowId !== undefined ? { workflowId: opts.workflowId } : {}),
      }),
    ],
    controllers: [DynamicController],
  })
  class AppModule {}

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe("TailraceModule Nest+Express", () => {
  it("returns 422 when request contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "nest-req-secret" }) });
    const app = await makeApp(tailrace);
    const res = await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .send(chatBody(`use ${SECRET}`));
    expect(res.status).toBe(422);
    expect(res.body.error.entity).toBe("api_key");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    await app.close();
  });

  it("tokenizes email in forwarded request body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "nest-req-email" }) });
    const app = await makeApp(tailrace, { workflowId: "w1" });
    const res = await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .send(chatBody(`hello ${EMAIL}`));
    // Nest @Post defaults to 201 Created.
    expect([200, 201]).toContain(res.status);
    expect(String(res.body.echo)).not.toContain(EMAIL);
    expect(String(res.body.echo)).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    await app.close();
  });

  it("returns 422 when completion contains a secret", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "nest-res-secret" }) });
    const app = await makeApp(tailrace, { responseContent: `leak ${SECRET}` });
    const res = await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .send(chatBody("say hi"));
    expect(res.status).toBe(422);
    expect(res.body.error.entity).toBe("api_key");
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
    await app.close();
  });

  it("tokenizes email in completion body", async () => {
    const tailrace = createTailrace({ vault: memoryVault({ key: "nest-res-email" }) });
    const app = await makeApp(tailrace, {
      responseContent: `contact ${EMAIL}`,
      workflowId: "w2",
    });
    const res = await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .send(chatBody("lookup"));
    expect([200, 201]).toContain(res.status);
    const text = res.body.choices[0].message.content as string;
    expect(text).not.toContain(EMAIL);
    expect(text).toMatch(/<[A-Z0-9_]+_[a-z0-9]{8}>/);
    await app.close();
  });
});

// Keep ChatController referenced so Nest tooling does not tree-shake the pattern example.
void ChatController;
