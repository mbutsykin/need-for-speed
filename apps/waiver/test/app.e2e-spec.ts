import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";

import { AppModule } from "./../src/app.module";

// AppModule boots TelegrafModule, which requires a token; the bot is prevented
// from launching under tests (NODE_ENV=test), so this stays hermetic.
process.env.TELEGRAM_BOT_TOKEN = "test-token";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer()).get("/").expect(200).expect("Hello World!");
  });

  afterEach(async () => {
    // The bot is never launched in tests (launchOptions:false), so Telegraf's
    // stop() during shutdown throws "Bot is not running!" — expected, ignore it.
    await app.close().catch(() => undefined);
  });
});
