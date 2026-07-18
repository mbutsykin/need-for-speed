import "reflect-metadata";

import type { I18nService } from "nestjs-i18n";
import type { Scenes } from "telegraf";

import { IntakeScene } from "./intake.scene";
import type { IntakeState } from "./intake.types";

// Mock i18n: return the key, so reply-keyboard button comparisons are
// deterministic (e.g. this.i18n.t("intake.menu-done") === "intake.menu-done").
const i18n = { t: (key: string) => key } as unknown as I18nService;

interface MockCtx {
  from: { first_name: string; language_code: string };
  reply: jest.Mock;
  scene: { state: IntakeState; leave: jest.Mock; reenter: jest.Mock };
}

function makeCtx(state: Partial<IntakeState> = {}): MockCtx {
  return {
    from: { first_name: "Maksym", language_code: "en" },
    reply: jest.fn().mockResolvedValue(undefined),
    scene: {
      state: { participants: [], draft: {}, stage: "collecting", ...state } as IntakeState,
      leave: jest.fn().mockResolvedValue(undefined),
      reenter: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function asCtx(ctx: MockCtx): Scenes.SceneContext {
  return ctx as unknown as Scenes.SceneContext;
}

describe("IntakeScene", () => {
  let scene: IntakeScene;

  beforeEach(() => {
    scene = new IntakeScene(i18n);
  });

  it("initializes state and prompts on entry", async () => {
    const ctx = makeCtx();

    await scene.onEnter(asCtx(ctx));

    expect(ctx.scene.state.participants).toEqual([]);
    expect(ctx.scene.state.stage).toBe("collecting");
    expect(ctx.reply).toHaveBeenCalledTimes(2); // greeting + ask-self
  });

  it("completes a participant from one multi-field message", async () => {
    const ctx = makeCtx();

    await scene.onText(
      asCtx(ctx),
      "Maksym Butsykin\nmbutsykin@gmail.com\n+380989126059\n20.05.1994",
    );

    expect(ctx.scene.state.participants).toEqual([
      {
        name: "Maksym Butsykin",
        email: "mbutsykin@gmail.com",
        phone: "+380989126059",
        birthday: "1994-05-20",
      },
    ]);
    expect(ctx.scene.state.stage).toBe("menu");
  });

  it("captures a shared contact then asks for the still-missing birthday", async () => {
    const ctx = makeCtx();

    await scene.onContact(asCtx(ctx), { phone_number: "+380989126059", first_name: "Maksym" });

    expect(ctx.scene.state.draft).toEqual({ name: "Maksym", phone: "+380989126059" });
    expect(ctx.scene.state.stage).toBe("collecting"); // not complete yet
    expect(ctx.reply).toHaveBeenCalledWith("intake.ask-birthday", expect.anything());
  });

  it("does not overwrite an existing name with an invalid follow-up", async () => {
    const ctx = makeCtx({ draft: { name: "Bob", phone: "+1" } });

    await scene.onText(asCtx(ctx), "not-a-date");

    expect(ctx.scene.state.draft.name).toBe("Bob");
    expect(ctx.reply).toHaveBeenCalledWith("intake.ask-birthday", expect.anything());
  });

  it("loops back to collecting on Add another", async () => {
    const ctx = makeCtx({ participants: [{ name: "Bob" }], stage: "menu" });

    await scene.onText(asCtx(ctx), "intake.menu-add-another");

    expect(ctx.scene.state.stage).toBe("collecting");
    expect(ctx.scene.state.draft).toEqual({});
  });

  it("finishes and leaves on Done", async () => {
    const participants = [{ name: "Bob", phone: "+1", birthday: "1990-01-01" }];
    const ctx = makeCtx({ participants, stage: "menu" });

    await scene.onText(asCtx(ctx), "intake.menu-done");

    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("cancels on /cancel", async () => {
    const ctx = makeCtx({ draft: { name: "Bob" } });

    await scene.onText(asCtx(ctx), "/cancel");

    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });
});
