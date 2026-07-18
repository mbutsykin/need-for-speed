import { Module } from "@nestjs/common";

import { CustomersModule } from "../customers";

import { ChatBotService } from "./chat-bot.service";
import { IntakeScene } from "./scenes";

/** The Telegram chat bot: the entry-point update and the intake scene. */
@Module({
  imports: [CustomersModule],
  providers: [ChatBotService, IntakeScene],
})
export class ChatBotModule {}
