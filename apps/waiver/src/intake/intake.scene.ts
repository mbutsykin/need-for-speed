import { Injectable, Logger } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { Ctx, Message, On, Scene, SceneEnter } from "nestjs-telegraf";
import { Markup, Scenes } from "telegraf";

import { CANCEL_COMMAND, INTAKE_SCENE_ID } from "./intake.constants";
import type { IntakeState, MissingField } from "./intake.types";
import { isMinor, nextMissingField } from "./participant";
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
    // The first participant is the party leader — shadow-gather their username.
    state.draft = { username: ctx.from?.username };
    state.stage = "terms";

    await ctx.reply(
      this.i18n.t("intake.greeting", { lang, args: { name: ctx.from?.first_name ?? "" } }),
    );
    await ctx.reply(
      this.i18n.t("intake.terms", { lang }),
      Markup.keyboard([
        [Markup.button.text(this.i18n.t("intake.terms-accept", { lang }))],
        [Markup.button.text(this.i18n.t("intake.terms-decline", { lang }))],
      ])
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
    if (trimmed.startsWith("/")) return;

    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    if (state.stage === "terms") return this.onTerms(ctx, trimmed);
    if (state.stage === "menu") return this.onMenu(ctx, trimmed);
    if (state.stage === "consent") return this.onConsent(ctx, trimmed);

    const missing = nextMissingField(state.draft, state.participants.length === 0);

    // Button-answered steps aren't free-form, so handle them before parsing.
    if (missing === "guardian") return this.onGuardian(ctx, trimmed);
    if (missing === "contact" && trimmed === this.i18n.t("intake.contact-skip", { lang })) {
      state.draft.contactSkipped = true;

      return this.advance(ctx);
    }

    const fields = parseParticipantFields(text);

    // Don't let an unrecognized follow-up overwrite a name we already have.
    if (state.draft.name && fields.name) delete fields.name;
    Object.assign(state.draft, fields);

    await this.advance(ctx);
  }

  private async onTerms(ctx: Ctx, text: string): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    if (text === this.i18n.t("intake.terms-decline", { lang }))
      return this.finish(ctx, "cancelled");

    if (text !== this.i18n.t("intake.terms-accept", { lang })) {
      await ctx.reply(this.i18n.t("intake.terms-must-accept", { lang }));

      return;
    }

    state.stage = "collecting";

    await ctx.reply(
      this.i18n.t("intake.ask-self", { lang }),
      Markup.keyboard([[Markup.button.contactRequest(this.i18n.t("intake.share-phone", { lang }))]])
        .oneTime()
        .resize(),
    );
  }

  private async onGuardian(ctx: Ctx, text: string): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    // Leader won't vouch for the minor — drop them and return to the menu.
    if (text === this.i18n.t("intake.guardian-decline", { lang })) {
      state.draft = {};
      state.stage = "menu";

      return this.showMenu(ctx);
    }

    if (text !== this.i18n.t("intake.guardian-confirm", { lang })) return this.ask(ctx, "guardian");

    state.draft.guardianAck = true;

    await this.advance(ctx);
  }

  private async onConsent(ctx: Ctx, text: string): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    const consent =
      text === this.i18n.t("intake.consent-yes", { lang })
        ? true
        : text === this.i18n.t("intake.consent-no", { lang })
          ? false
          : null;

    if (consent === null) return this.askConsent(ctx);

    if (state.participants[0]) state.participants[0].consent = consent;

    await this.finish(ctx, "done");
  }

  private async advance(ctx: Ctx): Promise<void> {
    const state = ctx.scene.state as IntakeState;
    const isLeader = state.participants.length === 0;

    // The party leader must be an adult — a minor can't register a group.
    if (isLeader && state.draft.birthday && isMinor(state.draft.birthday)) {
      return this.finish(ctx, "minor-leader");
    }

    const missing = nextMissingField(state.draft, isLeader);

    if (missing) return this.ask(ctx, missing);

    state.participants.push(state.draft);
    state.draft = {};
    state.stage = "menu";

    await this.showMenu(ctx);
  }

  private async ask(ctx: Ctx, field: MissingField): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    if (field === "guardian") {
      await ctx.reply(
        this.i18n.t("intake.guardian", { lang, args: { name: state.draft.name ?? "" } }),
        Markup.keyboard([
          [Markup.button.text(this.i18n.t("intake.guardian-confirm", { lang }))],
          [Markup.button.text(this.i18n.t("intake.guardian-decline", { lang }))],
        ])
          .oneTime()
          .resize(),
      );

      return;
    }

    if (field === "contact") {
      const question = this.i18n.t("intake.ask-contact", { lang });

      // Only the leader (self) can share their own number; a minor may skip.
      if (state.participants.length === 0) {
        await ctx.reply(
          question,
          Markup.keyboard([
            [Markup.button.contactRequest(this.i18n.t("intake.share-phone", { lang }))],
          ])
            .oneTime()
            .resize(),
        );
      } else if (state.draft.birthday && isMinor(state.draft.birthday)) {
        await ctx.reply(
          question,
          Markup.keyboard([[Markup.button.text(this.i18n.t("intake.contact-skip", { lang }))]])
            .oneTime()
            .resize(),
        );
      } else {
        await ctx.reply(question, Markup.removeKeyboard());
      }

      return;
    }

    await ctx.reply(this.i18n.t(`intake.ask-${field}`, { lang }), Markup.removeKeyboard());
  }

  private async askConsent(ctx: Ctx): Promise<void> {
    const lang = ctx.from?.language_code;

    await ctx.reply(
      this.i18n.t("intake.ask-consent", { lang }),
      Markup.keyboard([
        [Markup.button.text(this.i18n.t("intake.consent-yes", { lang }))],
        [Markup.button.text(this.i18n.t("intake.consent-no", { lang }))],
      ])
        .oneTime()
        .resize(),
    );
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

    if (text === this.i18n.t("intake.menu-done", { lang })) {
      state.stage = "consent";

      return this.askConsent(ctx);
    }

    await ctx.reply(this.i18n.t("intake.menu-hint", { lang }));
  }

  private async finish(ctx: Ctx, kind: "done" | "cancelled" | "minor-leader"): Promise<void> {
    const lang = ctx.from?.language_code;
    const state = ctx.scene.state as IntakeState;

    // Re-offer the Register button after leaving, so a new run is one tap away.
    const registerButton = Markup.keyboard([
      [Markup.button.text(this.i18n.t("intake.register-button", { lang }))],
    ]).resize();

    if (kind !== "done") {
      const key = kind === "minor-leader" ? "intake.minor-leader" : "intake.cancelled";

      await ctx.reply(this.i18n.t(key, { lang }), registerButton);
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
