import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TelegrafModule } from "nestjs-telegraf";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { BotUpdate } from "./bot/bot.update";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>("TELEGRAM_BOT_TOKEN"),
        // Skip long-polling under tests so e2e stays hermetic (no network).
        launchOptions: config.get("NODE_ENV") === "test" ? false : undefined,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, BotUpdate],
})
export class AppModule {}
