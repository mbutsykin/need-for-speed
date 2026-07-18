import { Injectable, Logger } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { Ctx, Message, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup, Scenes } from "telegraf";

import { CANCEL_COMMAND, INTAKE_SCENE_ID } from "./intake.constants";
import type { IntakeState, MissingField } from "./intake.types";
import { nextMissingField } from "./participant";
import { parseParticipantFields } from "./validators";

type Ctx = Scenes.SceneContext;

@Injectable()
@Scene(INTAKE_SCENE_ID)
export class IntakeScene {
  private readonly logger = new Logger(IntakeScene.name);

  constructor(private readonly i18n: I18nService) {}

  @SceneEnter()
  async onEnter(@Ctx() ctx: Ctx): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    state.participants = [];
    state.draft = {};
    state.stage = "collecting";

    await ctx.reply(
      this.i18n.t("intake.greeting", { lang, args: { name: ctx.from?.first_name ?? "" } }),
    );
    await ctx.reply(
      this.i18n.t("intake.ask-self", { lang }),
      Markup.keyboard([[Markup.button.contactRequest(this.i18n.t("intake.share-phone", { lang }))]])
        .oneTime()
        .resize(),
    );
  }

  @On("contact")
  async onContact(
    @Ctx() ctx: Ctx,
    @Message("contact") contact: { phone_number: string; first_name?: string; last_name?: string },
  ): Promise<void> {
    const state = ctx.scene.state as IntakeState;

    if (state.stage !== "collecting") return;

    if (!state.draft.name) {
      state.draft.name = [contact.last_name, contact.first_name].filter(Boolean).join(" ");
    }
    if (!state.draft.phone) state.draft.phone = contact.phone_number;

    await this.advance(ctx);
  }

  @On("text")
  async onText(@Ctx() ctx: Ctx, @Message("text") text: string): Promise<void> {
    const trimmed = text.trim();

    if (trimmed === CANCEL_COMMAND) return this.finish(ctx, "cancelled");
    if (trimmed === "/start") return void ctx.scene.reenter();

    // Ignore other slash-commands so they aren't captured as a name.
    if (trimmed.startsWith("/")) return;

    const state = ctx.scene.state as IntakeState;

    if (state.stage === "menu") return this.onMenu(ctx, trimmed);

    const fields = parseParticipantFields(text);

    // Don't let an unrecognized follow-up overwrite a name we already have.
    if (state.draft.name && fields.name) delete fields.name;
    Object.assign(state.draft, fields);

    await this.advance(ctx);
  }

  private async advance(ctx: Ctx): Promise<void> {
    const state = ctx.scene.state as IntakeState;
    const missing = nextMissingField(state.draft);

    if (missing) return this.ask(ctx, missing);

    state.participants.push(state.draft);
    state.draft = {};
    state.stage = "menu";

    await this.showMenu(ctx);
  }

  private async ask(ctx: Ctx, field: MissingField): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    // Only the first participant (self) can share their own number via a button.
    if (field === "contact" && state.participants.length === 0) {
      await ctx.reply(
        this.i18n.t("intake.ask-contact", { lang }),
        Markup.keyboard([
          [Markup.button.contactRequest(this.i18n.t("intake.share-phone", { lang }))],
        ])
          .oneTime()
          .resize(),
      );

      return;
    }

    await ctx.reply(this.i18n.t(`intake.ask-${field}`, { lang }), Markup.removeKeyboard());
  }

  private async showMenu(ctx: Ctx): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;
    const last = state.participants[state.participants.length - 1];

    await ctx.reply(
      this.i18n.t("intake.added", {
        lang,
        args: { name: last?.name ?? "", count: state.participants.length },
      }),
      Markup.keyboard([
        [Markup.button.text(this.i18n.t("intake.menu-add-another", { lang }))],
        [Markup.button.text(this.i18n.t("intake.menu-done", { lang }))],
        [Markup.button.text(this.i18n.t("intake.menu-cancel", { lang }))],
      ])
        .oneTime()
        .resize(),
    );
  }

  private async onMenu(ctx: Ctx, text: string): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    if (text === this.i18n.t("intake.menu-add-another", { lang })) {
      state.stage = "collecting";
      state.draft = {};

      await ctx.reply(this.i18n.t("intake.add-another", { lang }), Markup.removeKeyboard());

      return;
    }

    if (text === this.i18n.t("intake.menu-cancel", { lang })) return this.finish(ctx, "cancelled");
    if (text === this.i18n.t("intake.menu-done", { lang })) return this.finish(ctx, "done");

    await ctx.reply(this.i18n.t("intake.menu-hint", { lang }));
  }

  private async finish(ctx: Ctx, kind: "done" | "cancelled"): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    // Re-offer the Register button after leaving, so a new run is one tap away.
    const registerButton = Markup.keyboard([
      [Markup.button.text(this.i18n.t("intake.register-button", { lang }))],
    ]).resize();

    if (kind === "cancelled") {
      await ctx.reply(this.i18n.t("intake.cancelled", { lang }), registerButton);
      await ctx.scene.leave();

      return;
    }

    // No DB yet — record the group so it's visible in the logs.
    this.logger.log(`Registration: ${JSON.stringify(state.participants)}`);

    const lines = state.participants.map((p, i) =>
      this.i18n.t("intake.summary-line", {
        lang,
        args: {
          index: i + 1,
          name: p.name ?? "",
          contact: p.phone ?? p.email ?? "—",
          birthday: p.birthday ? p.birthday.split("-").reverse().join(".") : "—",
        },
      }),
    );
    const title = this.i18n.t("intake.summary-title", { lang, args: { count: lines.length } });

    await ctx.reply(`${title}\n${lines.join("\n")}`, Markup.removeKeyboard());
    await ctx.reply(this.i18n.t("intake.done", { lang }), registerButton);
    await ctx.scene.leave();
  }
}
