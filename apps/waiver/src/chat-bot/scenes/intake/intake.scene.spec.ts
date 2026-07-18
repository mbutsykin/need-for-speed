import "reflect-metadata";

import type { I18nService } from "nestjs-i18n";
import type { Scenes } from "telegraf";

import { IntakeScene } from "./intake.scene";
import type { IntakeState, Participant } from "./types";

// Mock i18n: return the key, so reply-keyboard button comparisons are
// deterministic (e.g. this.i18n.t("intake.menu-done") === "intake.menu-done").
const i18n = { t: (key: string) => key } as unknown as I18nService;

const ADULT: Participant = { name: "Adult", phone: "+1", birthday: "1990-01-01" };

interface MockCtx {
  from: { first_name: string; language_code: string; username?: string };
  reply: jest.Mock;
  scene: { state: IntakeState; leave: jest.Mock; reenter: jest.Mock };
}

function makeCtx(state: Partial<IntakeState> = {}, username?: string): MockCtx {
  return {
    from: { first_name: "Maksym", language_code: "en", username },
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

  it("shows terms on entry and shadow-gathers the username", async () => {
    const ctx = makeCtx({}, "mbutsykin");

    await scene.onEnter(asCtx(ctx));

    expect(ctx.scene.state.stage).toBe("terms");
    expect(ctx.scene.state.draft.username).toBe("mbutsykin");
    expect(ctx.reply).toHaveBeenCalledTimes(2); // greeting + terms
  });

  it("starts collecting once terms are accepted", async () => {
    const ctx = makeCtx({ stage: "terms", draft: { username: "mbutsykin" } });

    await scene.onText(asCtx(ctx), "intake.terms-accept");

    expect(ctx.scene.state.stage).toBe("collecting");
  });

  it("leaves if terms are declined", async () => {
    const ctx = makeCtx({ stage: "terms" });

    await scene.onText(asCtx(ctx), "intake.terms-decline");

    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("completes an adult leader from one message (no per-person consent)", async () => {
    const ctx = makeCtx();

    await scene.onText(
      asCtx(ctx),
      "Maksym Butsykin\nmbutsykin@gmail.com\n+380989126059\n20.05.1990",
    );

    expect(ctx.scene.state.participants).toHaveLength(1);
    expect(ctx.scene.state.stage).toBe("menu");
  });

  it("asks contact after birthday, not before", async () => {
    const ctx = makeCtx({ draft: { name: "Bob" } });

    await scene.onText(asCtx(ctx), "20.05.1990");

    expect(ctx.reply).toHaveBeenCalledWith("intake.ask-contact", expect.anything());
  });

  it("asks for consent once on Done, then records it on the leader", async () => {
    const ctx = makeCtx({ participants: [{ ...ADULT }], stage: "menu" });

    await scene.onText(asCtx(ctx), "intake.menu-done");
    expect(ctx.scene.state.stage).toBe("consent");
    expect(ctx.reply).toHaveBeenCalledWith("intake.ask-consent", expect.anything());

    await scene.onText(asCtx(ctx), "intake.consent-no");
    expect(ctx.scene.state.participants[0].consent).toBe(false);
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });

  it("blocks an under-18 party leader", async () => {
    const ctx = makeCtx({ draft: { name: "Kid" } });

    await scene.onText(asCtx(ctx), "20.05.2015");

    expect(ctx.reply).toHaveBeenCalledWith("intake.minor-leader", expect.anything());
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(ctx.scene.state.participants).toEqual([]);
  });

  it("requires a guardian acknowledgment for a minor companion", async () => {
    const ctx = makeCtx({ participants: [{ ...ADULT }], draft: { name: "Kid" } });

    await scene.onText(asCtx(ctx), "20.05.2015");

    expect(ctx.reply).toHaveBeenCalledWith("intake.guardian", expect.anything());
  });

  it("asks contact (skippable) after the guardian confirms", async () => {
    const ctx = makeCtx({
      participants: [{ ...ADULT }],
      draft: { name: "Kid", birthday: "2015-05-20" },
    });

    await scene.onText(asCtx(ctx), "intake.guardian-confirm");

    expect(ctx.scene.state.draft.guardianAck).toBe(true);
    expect(ctx.reply).toHaveBeenCalledWith("intake.ask-contact", expect.anything());
  });

  it("drops the minor and returns to the menu if the guardian declines", async () => {
    const ctx = makeCtx({
      participants: [{ ...ADULT }],
      draft: { name: "Kid", birthday: "2015-05-20" },
    });

    await scene.onText(asCtx(ctx), "intake.guardian-decline");

    expect(ctx.scene.state.draft).toEqual({});
    expect(ctx.scene.state.stage).toBe("menu");
    expect(ctx.scene.state.participants).toHaveLength(1);
  });

  it("lets a minor companion skip the contact step", async () => {
    const ctx = makeCtx({
      participants: [{ ...ADULT }],
      draft: { name: "Kid", birthday: "2015-05-20", guardianAck: true },
    });

    await scene.onText(asCtx(ctx), "intake.contact-skip");

    expect(ctx.scene.state.participants).toHaveLength(2);
    expect(ctx.scene.state.stage).toBe("menu");
  });

  it("loops back to collecting on Add another", async () => {
    const ctx = makeCtx({ participants: [{ ...ADULT }], stage: "menu" });

    await scene.onText(asCtx(ctx), "intake.menu-add-another");

    expect(ctx.scene.state.stage).toBe("collecting");
    expect(ctx.scene.state.draft).toEqual({});
  });

  it("cancels on /cancel", async () => {
    const ctx = makeCtx({ draft: { name: "Bob" } });

    await scene.onText(asCtx(ctx), "/cancel");

    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
  });
});
