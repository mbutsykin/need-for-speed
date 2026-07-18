import { Ctx, Help, Start, Update } from "nestjs-telegraf";
import type { Context } from "telegraf";

/**
 * Root Telegram update handler. For now it just says hello — the customer
 * intake questionnaire will grow out of here.
 */
@Update()
export class BotUpdate {
  @Start()
  async onStart(@Ctx() ctx: Context): Promise<void> {
    await ctx.reply("Hello World 🏁 Welcome to the go-kart center bot!");
  }

  @Help()
  async onHelp(@Ctx() ctx: Context): Promise<void> {
    await ctx.reply("Send /start to say hello.");
  }
}
