import "reflect-metadata";

import type { I18nService } from "nestjs-i18n";
import type { Scenes } from "telegraf";

import { INTAKE_SCENE_ID } from "../intake/intake.constants";

import { BotUpdate } from "./bot.update";

// Mock i18n: return the key, so the Register-button comparison is deterministic.
const i18n = { t: (key: string) => key } as unknown as I18nService;

function makeCtx() {
  return {
    from: { language_code: "en" },
    reply: jest.fn().mockResolvedValue(undefined),
    scene: { enter: jest.fn().mockResolvedValue(undefined) },
  };
}

function asCtx(ctx: ReturnType<typeof makeCtx>): Scenes.SceneContext {
  return ctx as unknown as Scenes.SceneContext;
}

describe("BotUpdate", () => {
  let update: BotUpdate;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    update = new BotUpdate(i18n);
    ctx = makeCtx();
  });

  it("shows the Register button on /start", async () => {
    await update.onStart(asCtx(ctx));

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    expect(ctx.scene.enter).not.toHaveBeenCalled();
  });

  it("enters the intake scene when the Register button is tapped", async () => {
    await update.onText(asCtx(ctx), "intake.register-button");

    expect(ctx.scene.enter).toHaveBeenCalledWith(INTAKE_SCENE_ID);
  });

  it("re-shows the Register button for any other message", async () => {
    await update.onText(asCtx(ctx), "hello");

    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it("ignores slash-commands in the text handler", async () => {
    await update.onText(asCtx(ctx), "/whatever");

    expect(ctx.scene.enter).not.toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });
});
