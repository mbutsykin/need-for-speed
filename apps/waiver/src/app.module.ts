import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { I18nModule } from "nestjs-i18n";
import { TelegrafModule } from "nestjs-telegraf";
import { session } from "telegraf";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BotUpdate } from "./bot/bot.update";
import { IntakeScene } from "./intake/intake.scene";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    I18nModule.forRoot({
      fallbackLanguage: "en",
      // Region codes (e.g. "ru-RU") resolve to the base language; anything we
      // don't ship falls back to English.
      fallbacks: {
        "en-*": "en",
        "uk-*": "uk",
        "ru-*": "ru",
      },
      // We pass the language per call, so the request interceptor is unused —
      // disabling it also stops the "context type: telegraf not supported"
      // warning it logs on every message.
      disableMiddleware: true,
      logging: false,
      loaderOptions: {
        path: join(__dirname, "i18n"),
        watch: false,
      },
    }),
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>("TELEGRAM_BOT_TOKEN"),
        // Session backs the scene state; skip long-polling under tests (no network).
        middlewares: [session()],
        launchOptions: config.get("NODE_ENV") === "test" ? false : undefined,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate, IntakeScene],
})
export class AppModule {}
