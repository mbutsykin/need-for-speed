import "reflect-metadata";

import type { Context } from "telegraf";

import { BotUpdate } from "./bot.update";

describe("BotUpdate", () => {
  let update: BotUpdate;
  let reply: jest.Mock;
  let ctx: Context;

  beforeEach(() => {
    update = new BotUpdate();
    reply = jest.fn().mockResolvedValue(undefined);
    ctx = { reply } as unknown as Context;
  });

  it('greets the user with "Hello World" on /start', async () => {
    await update.onStart(ctx);

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("Hello World"));
  });

  it("explains itself on /help", async () => {
    await update.onHelp(ctx);

    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("/start"));
  });
});
