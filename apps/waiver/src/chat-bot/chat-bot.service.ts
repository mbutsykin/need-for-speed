import { I18nService } from "nestjs-i18n";
import { Ctx, Help, Message, On, Start, Update } from "nestjs-telegraf";
import { Markup, Scenes } from "telegraf";

import { EScene } from "./scenes";

type Ctx = Scenes.SceneContext;

/** Entry point: a Register button that launches the intake scene. */
@Update()
export class ChatBotService {
  constructor(private readonly i18n: I18nService) {}

  @Start()
  async onStart(@Ctx() ctx: Ctx): Promise<void> {
    await this.showWelcome(ctx);
  }

  @Help()
  async onHelp(@Ctx() ctx: Ctx): Promise<void> {
    await this.showWelcome(ctx);
  }

  @On("text")
  async onText(@Ctx() ctx: Ctx, @Message("text") text: string): Promise<void> {
    // Commands are handled by their own decorators; ignore them here.
    if (text.startsWith("/")) return;

    const lang = ctx.from?.language_code;

    if (text.trim() === this.i18n.t("intake.register-button", { lang })) {
      await ctx.scene.enter(EScene.intake);

      return;
    }

    await this.showWelcome(ctx);
  }

  private async showWelcome(ctx: Ctx): Promise<void> {
    const lang = ctx.from?.language_code;

    await ctx.reply(
      this.i18n.t("intake.welcome", { lang }),
      Markup.keyboard([
        [Markup.button.text(this.i18n.t("intake.register-button", { lang }))],
      ]).resize(),
    );
  }
}
